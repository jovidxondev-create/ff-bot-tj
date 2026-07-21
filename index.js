require('dotenv').config()
const { Telegraf, session } = require('telegraf')
const axios = require('axios')

const {
  saveUser, getLang, setLang,
  getPackages, getSettings,
  createOrder, setScreenshot, getOrder,
  updateOrderStatus, getUserOrders, getStats
} = require('./api')

const {
  langKeyboard, mainMenuKeyboard, confirmAccountKeyboard,
  packagesKeyboard, paymentKeyboard, backKeyboard, adminOrderKeyboard
} = require('./keyboards')

const { t } = require('./locales')

const bot = new Telegraf(process.env.BOT_TOKEN)
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(Number)

bot.use(session())

// ─── SESSION BOSHLASH ─────────────────────────────────
bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {}
  return next()
})

// ─── FF ACCOUNT TEKSHIRISH ────────────────────────────
async function checkFFAccount(playerId) {
  try {
    const res = await axios.get(
      `https://www.hlgamingofficial.com/api/ff/?uid=${playerId}&region=IND`,
      { timeout: 8000 }
    )
    if (res.data && res.data.nickname) return res.data.nickname
    return null
  } catch {
    return null
  }
}

// ─── /start ──────────────────────────────────────────
bot.start(async (ctx) => {
  ctx.session = {}
  const u = ctx.from
  await saveUser(u.id, u.username || '', u.first_name + (u.last_name ? ' ' + u.last_name : ''))
  await ctx.replyWithHTML(
    '🌐 Выберите язык / Забонро интихоб кунед:',
    langKeyboard()
  )
})

// ─── ЗАБОН ───────────────────────────────────────────
bot.action(['lang_ru', 'lang_tj'], async (ctx) => {
  ctx.session = {}
  const lang = ctx.callbackQuery.data === 'lang_ru' ? 'ru' : 'tj'
  await setLang(ctx.from.id, lang)
  ctx.session.lang = lang
  await ctx.editMessageText(t(lang, 'lang_set'))
  await ctx.replyWithHTML(t(lang, 'main_menu'), mainMenuKeyboard(lang))
  await ctx.answerCbQuery()
})

bot.action('change_lang', async (ctx) => {
  ctx.session = {}
  await ctx.editMessageText(
    '🌐 Выберите язык / Забонро интихоб кунед:',
    langKeyboard()
  )
  await ctx.answerCbQuery()
})

// ─── ASOSIY MENU ─────────────────────────────────────
bot.action('main_menu', async (ctx) => {
  ctx.session = {}
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  ctx.session.lang = lang
  await ctx.editMessageText(t(lang, 'main_menu'), { parse_mode: 'HTML', ...mainMenuKeyboard(lang) })
  await ctx.answerCbQuery()
})

// ─── ALMOS XARID ─────────────────────────────────────
bot.action('buy_diamonds', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  ctx.session.lang = lang
  ctx.session.step = 'waiting_ff_id'
  await ctx.editMessageText(t(lang, 'enter_id'), { parse_mode: 'HTML', ...backKeyboard(lang) })
  await ctx.answerCbQuery()
})

// ─── XABAR QAYTA ISHLASH ─────────────────────────────
bot.on('text', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  ctx.session.lang = lang
  const step = ctx.session.step

  // FF ID KIRITISH
  if (step === 'waiting_ff_id') {
    const ffId = ctx.message.text.trim()
    if (!/^\d+$/.test(ffId)) {
      return ctx.replyWithHTML(t(lang, 'id_not_found'), backKeyboard(lang))
    }
    const msg = await ctx.replyWithHTML(t(lang, 'checking_id'))
    let ffName = await checkFFAccount(ffId)
    if (!ffName) ffName = `Player_${ffId.slice(-4)}`

    ctx.session.ff_id = ffId
    ctx.session.ff_name = ffName
    ctx.session.step = 'waiting_package'

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id)
    await ctx.replyWithHTML(
      t(lang, 'confirm_account', { name: ffName, id: ffId }),
      confirmAccountKeyboard(lang)
    )
    return
  }
})

// ─── ID TASDIQLASH ───────────────────────────────────
bot.action('confirm_id', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  ctx.session.lang = lang
  const packages = await getPackages()
  ctx.session.packages = packages
  await ctx.editMessageText(
    t(lang, 'choose_package'),
    { parse_mode: 'HTML', ...packagesKeyboard(lang, packages) }
  )
  await ctx.answerCbQuery()
})

bot.action('wrong_id', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  ctx.session.step = 'waiting_ff_id'
  await ctx.editMessageText(t(lang, 'enter_id'), { parse_mode: 'HTML', ...backKeyboard(lang) })
  await ctx.answerCbQuery()
})

// ─── PAKET TANLASH ───────────────────────────────────
bot.action(/^pkg_(\d+)$/, async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  ctx.session.lang = lang
  const pkgId = parseInt(ctx.match[1])
  const packages = ctx.session.packages || await getPackages()
  const pkg = packages.find(p => p.id == pkgId)
  if (!pkg) return ctx.answerCbQuery()

  const settings = await getSettings()
  const name = lang === 'ru' ? pkg.name_ru : pkg.name_tj

  ctx.session.package_id   = pkg.id
  ctx.session.package_name = name
  ctx.session.price        = pkg.price
  ctx.session.step         = 'waiting_screenshot'

  const text = t(lang, 'package_info', { name, price: pkg.price }) + '\n\n' +
    t(lang, 'payment_info', {
      card:  settings.card_number  || '9762000000682707',
      owner: settings.card_owner   || 'Манижа.Х.З',
      price: pkg.price
    })

  await ctx.editMessageText(text, { parse_mode: 'HTML', ...paymentKeyboard(lang) })
  await ctx.answerCbQuery()
})

// ─── SCREENSHOT ──────────────────────────────────────
bot.on('photo', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  ctx.session.lang = lang

  if (ctx.session.step !== 'waiting_screenshot') return

  const { ff_id, ff_name, package_id, package_name, price } = ctx.session
  if (!ff_id || !package_id) {
    return ctx.replyWithHTML(t(lang, 'btn_main_menu'), mainMenuKeyboard(lang))
  }

  const { orderId, queue } = await createOrder(
    ctx.from.id, ff_id, ff_name, package_id, package_name, price
  )

  const photo = ctx.message.photo.at(-1)
  await setScreenshot(orderId, photo.file_id)

  await ctx.replyWithHTML(
    t(lang, 'order_accepted', {
      order_id: orderId,
      ff_name,
      package: package_name,
      price,
      queue
    }),
    backKeyboard(lang)
  )

  // ADMIN GA XABAR
  const u = ctx.from
  const adminText =
    `🆕 <b>Янги фармоиш №${orderId}</b>\n\n` +
    `👤 Харидор: ${u.first_name} (@${u.username || 'йӯқ'})\n` +
    `🆔 TG ID: <code>${u.id}</code>\n` +
    `🔥 FF ID: <code>${ff_id}</code>\n` +
    `👤 FF Ном: <b>${ff_name}</b>\n` +
    `💎 Пакет: <b>${package_name}</b>\n` +
    `💰 Маблағ: <b>${price} сомонӣ</b>\n` +
    `⏳ Навбат: <b>${queue}</b>\n` +
    `🕐 Вақт: ${new Date().toLocaleString('ru-RU')}`

  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendPhoto(adminId, photo.file_id, {
        caption: adminText,
        parse_mode: 'HTML',
        ...adminOrderKeyboard(orderId, u.id)
      })
    } catch (e) {
      console.error(`Admin ${adminId} га хабар юборилмади:`, e.message)
    }
  }

  ctx.session = { lang }
})

// ─── ADMIN TASDIQLASH / RAD ───────────────────────────
bot.action(/^adm_(done|reject)_(\d+)_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('❌ Рухсат йӯқ')

  const action  = ctx.match[1]
  const orderId = ctx.match[2]
  const userId  = parseInt(ctx.match[3])

  const order = await getOrder(orderId)
  if (!order) return ctx.answerCbQuery('Фармоиш ёфт нашуд!')

  const lang = await getLang(userId)

  if (action === 'done') {
    await updateOrderStatus(orderId, 'done')
    await ctx.telegram.sendMessage(userId,
      t(lang, 'order_done', {
        order_id: orderId,
        package:  order.package_name,
        ff_name:  order.ff_name,
        ff_id:    order.ff_id
      }),
      { parse_mode: 'HTML' }
    )
    await ctx.editMessageCaption(
      (ctx.callbackQuery.message.caption || '') + '\n\n✅ <b>ТАСДИҚ ШУД</b>',
      { parse_mode: 'HTML' }
    )
    await ctx.answerCbQuery('✅ Тасдиқ шуд!')

  } else {
    await updateOrderStatus(orderId, 'rejected')
    await ctx.telegram.sendMessage(userId,
      t(lang, 'order_rejected', { order_id: orderId }),
      { parse_mode: 'HTML' }
    )
    await ctx.editMessageCaption(
      (ctx.callbackQuery.message.caption || '') + '\n\n❌ <b>РАД ШУД</b>',
      { parse_mode: 'HTML' }
    )
    await ctx.answerCbQuery('❌ Рад шуд!')
  }
})

// ─── PROFIL ──────────────────────────────────────────
bot.action('my_profile', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  const orders = await getUserOrders(ctx.from.id)
  await ctx.editMessageText(
    t(lang, 'profile_text', {
      tg_id:  ctx.from.id,
      name:   ctx.from.first_name,
      orders: orders.length
    }),
    { parse_mode: 'HTML', ...backKeyboard(lang) }
  )
  await ctx.answerCbQuery()
})

// ─── TARIX ───────────────────────────────────────────
bot.action('history', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  const orders = await getUserOrders(ctx.from.id)

  if (!orders.length) {
    await ctx.editMessageText(t(lang, 'no_orders'), { parse_mode: 'HTML', ...backKeyboard(lang) })
    return ctx.answerCbQuery()
  }

  const statusMap = {
    pending:  t(lang, 'status_pending'),
    done:     t(lang, 'status_done'),
    rejected: t(lang, 'status_rejected')
  }

  let text = t(lang, 'order_history')
  for (const o of orders) {
    text += t(lang, 'order_item', {
      id:      o.id,
      package: o.package_name,
      price:   o.price,
      status:  statusMap[o.status] || o.status,
      date:    o.created_at?.slice(0, 10) || ''
    })
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKeyboard(lang) })
  await ctx.answerCbQuery()
})

// ─── QOLLAB QUVVATLASH ───────────────────────────────
bot.action('support', async (ctx) => {
  const lang = ctx.session.lang || await getLang(ctx.from.id)
  await ctx.editMessageText(t(lang, 'support_text'), { parse_mode: 'HTML', ...backKeyboard(lang) })
  await ctx.answerCbQuery()
})

// ─── ADMIN KOMANDALAR ────────────────────────────────
bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return
  const s = await getStats()
  await ctx.replyWithHTML(
    `📊 <b>Статистика</b>\n\n` +
    `👥 Жами харидорон: <b>${s.users}</b>\n` +
    `📦 Иҷро шуда: <b>${s.done}</b>\n` +
    `⏳ Интизор: <b>${s.pending}</b>\n` +
    `💰 Даромад: <b>${s.revenue} сомонӣ</b>`
  )
})

// ─── ISHGA TUSHIRISH ─────────────────────────────────
bot.launch().then(() => {
  console.log('✅ FF Diamonds Bot ishga tushdi!')
}).catch(err => {
  console.error('❌ Bot xato:', err)
})

process.once('SIGINT',  () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
