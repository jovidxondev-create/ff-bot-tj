require('dotenv').config()
const { Telegraf, session, Markup } = require('telegraf')
const fetch = require('node-fetch')

const {
  saveUser, getLang, setLang,
  getPackages, getSettings,
  createOrder, setScreenshot, getOrder,
  updateOrderStatus, getUserOrders, getStats
} = require('./api')

const { adminOrderKeyboard } = require('./keyboards')

const bot = new Telegraf(process.env.BOT_TOKEN || '')
const ADMIN_IDS      = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean)
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN || ''
const API_URL        = process.env.API_URL  || 'http://jovidxondev-topup.atwebpages.com'
const API_KEY        = process.env.API_KEY  || 'ffbot_api_key_jovidxon_2026'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026'
const CARD_IMG       = process.env.CARD_IMG  || ''
const APK_FILE_1     = process.env.APK_FILE_1 || '' // Almos TopUp APK
const APK_FILE_2     = process.env.APK_FILE_2 || '' // FreeFire Sensi APK

bot.use(session())
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next() })

// ─── HELPERS ─────────────────────────────────────────
async function getLangS(ctx) {
  if (!ctx.session.lang) ctx.session.lang = await getLang(ctx.from.id)
  return ctx.session.lang
}

function payLink(price) {
  return `http://pay.expresspay.tj/?A=9762000000682707&s=${price}&c=&f1=133&FIELD2=&FIELD3=`
}

// Заявкаро Admin ботга юбориш
async function sendToAdminBot(text, kb = null) {
  if (!ADMIN_BOT_TOKEN || !ADMIN_IDS.length) return
  try {
    const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`
    for (const adminId of ADMIN_IDS) {
      const body = { chat_id: adminId, text, parse_mode: 'HTML' }
      if (kb) body.reply_markup = JSON.stringify(kb)
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
  } catch (e) { console.error('Admin bot xato:', e.message) }
}

// ─── ЯКХЕЛА КЛАВИАТУРЛАР ─────────────────────────────
const langKb = () => Markup.inlineKeyboard([
  [Markup.button.callback('🇹🇯 Тоҷикӣ', 'lang_tj'), Markup.button.callback('🇷🇺 Русский', 'lang_ru')]
])

function mainKb(lang) {
  const tj = lang === 'tj'
  return Markup.inlineKeyboard([
    [Markup.button.callback('💎 ' + (tj ? 'Алмос харидан' : 'Купить Алмазы'), 'buy_diamonds')],
    [
      Markup.button.callback(tj ? '👤 Профил' : '👤 Профиль', 'my_profile'),
      Markup.button.callback(tj ? '📋 Таърих' : '📋 История', 'history')
    ],
    [
      Markup.button.callback(tj ? '🆘 Дастгирӣ' : '🆘 Поддержка', 'support'),
      Markup.button.callback(tj ? '📱 APK Юклаш' : '📱 Скачать APK', 'download_apk')
    ],
    [Markup.button.callback(tj ? '🌐 Забон иваз кунед' : '🌐 Сменить язык', 'change_lang')]
  ])
}

function backKb(lang) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]
  ])
}

function menuText(lang) {
  return lang === 'tj'
    ? `🏠 <b>Менюи асосӣ</b>\n\n🔥 <b>Garena Shop TJK 🇹🇯</b>\n💎 Алмос хариди зуд ва осон\n⚡ Зуд ба аккаунт мерасад`
    : `🏠 <b>Главное меню</b>\n\n🔥 <b>Garena Shop TJK 🇹🇯</b>\n💎 Быстрое пополнение алмазов\n⚡ Мгновенное зачисление`
}

async function goMainMenu(ctx, lang) {
  const text = menuText(lang)
  const kb = mainKb(lang)
  try { await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb }) }
  catch { await ctx.replyWithHTML(text, kb) }
}

// ─── /start ──────────────────────────────────────────
bot.start(async (ctx) => {
  ctx.session = {}
  const u = ctx.from
  await saveUser(u.id, u.username || '', `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`)
  await ctx.replyWithHTML('🌐 <b>Выберите язык / Забонро интихоб кунед:</b>', langKb())
})

// ─── ЗАБОН ───────────────────────────────────────────
bot.action(['lang_ru', 'lang_tj'], async (ctx) => {
  ctx.session = {}
  const lang = ctx.callbackQuery.data === 'lang_tj' ? 'tj' : 'ru'
  await setLang(ctx.from.id, lang)
  ctx.session.lang = lang
  await ctx.editMessageText(lang === 'tj' ? '✅ Забон: Тоҷикӣ 🇹🇯' : '✅ Язык: Русский 🇷🇺')
  await ctx.replyWithHTML(menuText(lang), mainKb(lang))
  await ctx.answerCbQuery()
})

bot.action('change_lang', async (ctx) => {
  ctx.session.step = null
  await ctx.editMessageText('🌐 <b>Выберите язык / Забонро интихоб кунед:</b>', { parse_mode: 'HTML', ...langKb() })
  await ctx.answerCbQuery()
})

// ─── АСОСИЙ МЕНЮ ─────────────────────────────────────
bot.action('main_menu', async (ctx) => {
  ctx.session.step = null
  const lang = await getLangS(ctx)
  await goMainMenu(ctx, lang)
  await ctx.answerCbQuery()
})

// ─── АЛМОС ХАРИДИ ────────────────────────────────────
bot.action('buy_diamonds', async (ctx) => {
  const lang = await getLangS(ctx)
  ctx.session.step = 'waiting_ff_id'
  const text = lang === 'tj'
    ? `🔥 <b>Free Fire ID-и худро ворид кунед:</b>\n\nМасалан: <code>708957035</code>\n\n📌 ID-ро дар бозӣ ёбед:\n<b>Профил → Нусха гиред</b>`
    : `🔥 <b>Введите ваш ID аккаунта Free Fire:</b>\n\nНапример: <code>708957035</code>\n\n📌 ID можно найти в игре:\n<b>Профиль → Скопировать ID</b>`
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKb(lang) })
  } catch {
    await ctx.replyWithHTML(text, backKb(lang))
  }
  await ctx.answerCbQuery()
})

// ─── ПАКЕТЛАРНИ КЎРСАТИШ ────────────────────────────
async function showPackages(ctx, lang) {
  const packages = await getPackages()
  ctx.session.packages = packages
  const rows = packages.map(p => {
    const name = lang === 'ru' ? p.name_ru : p.name_tj
    return [Markup.button.callback(`${name} — ${p.price} сом`, `pkg_${p.id}`)]
  })
  rows.push([Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')])
  const text = lang === 'tj'
    ? `💎 <b>Пакетро интихоб кунед:</b>\n\n🆔 FF ID: <code>${ctx.session.ff_id}</code>`
    : `💎 <b>Выберите пакет алмазов:</b>\n\n🆔 FF ID: <code>${ctx.session.ff_id}</code>`
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) })
  } catch {
    await ctx.replyWithHTML(text, Markup.inlineKeyboard(rows))
  }
}

// ─── МАТН ────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const lang = await getLangS(ctx)
  const step = ctx.session.step || ''
  const text = ctx.message.text.trim()

  // ── FF ID ──
  if (step === 'waiting_ff_id') {
    if (!/^\d{6,15}$/.test(text)) {
      return ctx.replyWithHTML(
        lang === 'tj' ? '❌ ID нодуруст! Танҳо рақамҳо ворид кунед.' : '❌ Неверный ID! Введите только цифры.',
        backKb(lang)
      )
    }
    ctx.session.ff_id = text
    ctx.session.step = 'waiting_package'
    return showPackages(ctx, lang)
  }

  // ── ДАСТГИРӢ ХАБАР ──
  if (step === 'waiting_support_msg' || step === 'in_support_chat') {
    const u = ctx.from
    ctx.session.step = 'in_support_chat'
    const adminText =
      `📩 <b>${step === 'waiting_support_msg' ? 'Янги муроҷиат' : 'Давоми сухбат'}!</b>\n` +
      `👤 ${u.first_name} (@${u.username || 'йӯқ'})\n` +
      `🆔 <code>${u.id}</code>\n\n💬 ${text}`
    const adminKb = {
      inline_keyboard: [
        [{ text: '💬 Ҷавоб бер', callback_data: `reply_${u.id}` }],
        [{ text: '🔴 Сухбатро бастан', callback_data: `close_chat_${u.id}` }]
      ]
    }
    for (const adminId of ADMIN_IDS) {
      await bot.telegram.sendMessage(adminId, adminText, { parse_mode: 'HTML', reply_markup: adminKb }).catch(() => {})
    }
    await sendToAdminBot(adminText, adminKb)

    const userKb = Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'tj' ? '🔴 Сухбатро бастан' : '🔴 Закрыть чат', `close_chat_${ctx.from.id}`)],
      [Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]
    ])

    if (step === 'waiting_support_msg') {
      return ctx.replyWithHTML(
        lang === 'tj'
          ? `✅ <b>Хабар қабул шуд!</b>\nAdmin зуд ҷавоб медиҳад.\n\n📝 Давом навишта метавонед...`
          : `✅ <b>Сообщение принято!</b>\nAdmin скоро ответит.\n\n📝 Можете продолжать писать...`,
        userKb
      )
    }
    return
  }

  // ── ADMIN ҶАВОБ ──
  if (step && step.startsWith('replying_to_')) {
    const targetId = parseInt(step.replace('replying_to_', ''))
    const tLang = await getLang(targetId)
    try {
      await bot.telegram.sendMessage(targetId,
        `📨 <b>${tLang === 'tj' ? 'Ҷавоби Admin' : 'Ответ Admin'}:</b>\n\n${text}`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback(tLang === 'tj' ? '🔴 Сухбатро бастан' : '🔴 Закрыть чат', `close_chat_${targetId}`)]])
        }
      )
      await ctx.replyWithHTML('✅ Ҷавоб фиристода шуд!')
    } catch { await ctx.replyWithHTML('❌ Хабар фиристода нашуд!') }
    ctx.session.step = null
    return
  }

  // ── ADMIN ПАНЕЛ РАМЗ ──
  if (step === 'waiting_admin_pass') {
    ctx.session.admin_attempts = (ctx.session.admin_attempts || 0) + 1
    if (text === ADMIN_PASSWORD) {
      ctx.session.step = 'admin_panel_open'
      ctx.session.admin_attempts = 0
      return showAdminPanel(ctx)
    }
    const left = 3 - ctx.session.admin_attempts
    if (left <= 0) {
      ctx.session.step = null
      ctx.session.admin_attempts = 0
      return ctx.replyWithHTML(
        '🔒 <b>3 маротиба хато кирилди!</b>\nПанел муваqqат баста шуд.\n\nДубора уриниш учун /admin_panel'
      )
    }
    return ctx.replyWithHTML(
      `❌ <b>Рамз нодуруст!</b>\nБоқӣ: <b>${left}</b> кӯшиш\n\nДубора уриниб кўринг:`
    )
  }
})

// ─── ПАКЕТ ИНТИХОБ ───────────────────────────────────
bot.action(/^pkg_(\d+)$/, async (ctx) => {
  const lang = await getLangS(ctx)
  const pkgId = parseInt(ctx.match[1])
  const packages = ctx.session.packages || await getPackages()
  const pkg = packages.find(p => p.id == pkgId)
  if (!pkg) return ctx.answerCbQuery()

  const name = lang === 'ru' ? pkg.name_ru : pkg.name_tj
  ctx.session.package_id   = pkg.id
  ctx.session.package_name = name
  ctx.session.price        = pkg.price
  ctx.session.step         = 'waiting_screenshot'

  const CARD  = '9762000000682707'
  const OWNER = 'Манижа.Х.З'
  const link  = payLink(pkg.price)

  const caption = lang === 'tj'
    ? `📦 <b>Интихоби шумо:</b>\n\n💎 ${name}\n💰 Нарх: <b>${pkg.price} сомонӣ</b>\n\n` +
      `━━━━━━━━━━━━━━━\n💳 <b>Ба корта пардохт кунед:</b>\n\n` +
      `🏦 Рақами корта:\n<code>${CARD}</code>\n` +
      `👤 Соҳиб: <b>${OWNER}</b>\n` +
      `💵 Маблағ: <b>${pkg.price} сомонӣ</b>\n` +
      `━━━━━━━━━━━━━━━\n\n📸 Пас аз пардохт <b>скриншот</b> фиристед!`
    : `📦 <b>Ваш выбор:</b>\n\n💎 ${name}\n💰 Цена: <b>${pkg.price} сомони</b>\n\n` +
      `━━━━━━━━━━━━━━━\n💳 <b>Оплатите на карту:</b>\n\n` +
      `🏦 Номер карты:\n<code>${CARD}</code>\n` +
      `👤 Владелец: <b>${OWNER}</b>\n` +
      `💵 Сумма: <b>${pkg.price} сомони</b>\n` +
      `━━━━━━━━━━━━━━━\n\n📸 После оплаты отправьте <b>скриншот</b>!`

  const kb = Markup.inlineKeyboard([
    [Markup.button.url(lang === 'tj' ? `💳 DC Next — ${pkg.price} сом` : `💳 Оплатить DC Next — ${pkg.price} сом`, link)],
    [Markup.button.callback(lang === 'tj' ? '◀️ Пакетҳо' : '◀️ Пакеты', 'back_to_packages')],
    [Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]
  ])

  try { await ctx.deleteMessage() } catch {}
  if (CARD_IMG) {
    await ctx.replyWithPhoto(CARD_IMG, { caption, parse_mode: 'HTML', ...kb })
  } else {
    await ctx.replyWithHTML(caption, kb)
  }
  await ctx.answerCbQuery()
})

// ─── ПАКЕТЛАРГА ҚАЙТИШ ──────────────────────────────
bot.action('back_to_packages', async (ctx) => {
  const lang = await getLangS(ctx)
  try { await ctx.deleteMessage() } catch {}
  await showPackages(ctx, lang)
  await ctx.answerCbQuery()
})

// ─── СКРИНШОТ ────────────────────────────────────────
bot.on('photo', async (ctx) => {
  const lang = await getLangS(ctx)
  if (ctx.session.step !== 'waiting_screenshot') return

  const { ff_id, package_id, package_name, price } = ctx.session
  if (!ff_id || !package_id) return

  const { orderId, queue } = await createOrder(ctx.from.id, ff_id, ff_id, package_id, package_name, price)
  const photo = ctx.message.photo.at(-1)
  await setScreenshot(orderId, photo.file_id)

  await ctx.replyWithHTML(
    lang === 'tj'
      ? `✅ <b>Фармоиши шумо қабул шуд!</b>\n\n🆔 №<b>${orderId}</b>\n🔥 FF ID: <code>${ff_id}</code>\n💎 <b>${package_name}</b>\n💰 <b>${price} сомонӣ</b>\n⏳ Навбат: <b>${queue}</b>-ум\n\n🔄 Пардохт тафтиш карда мешавад!`
      : `✅ <b>Ваш заказ принят!</b>\n\n🆔 №<b>${orderId}</b>\n🔥 FF ID: <code>${ff_id}</code>\n💎 <b>${package_name}</b>\n💰 <b>${price} сомони</b>\n⏳ Очередь: <b>${queue}</b>-й\n\n🔄 Проверяем оплату!`,
    mainKb(lang)
  )

  const u = ctx.from
  const orderText =
    `🆕 <b>Янги фармоиш №${orderId}</b>\n\n` +
    `👤 ${u.first_name} (@${u.username || 'йӯқ'})\n` +
    `🆔 TG: <code>${u.id}</code>\n` +
    `🔥 FF ID: <code>${ff_id}</code>\n` +
    `💎 <b>${package_name}</b>\n` +
    `💰 <b>${price} сомонӣ</b>\n` +
    `⏳ Навбат: <b>${queue}</b>`

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.telegram.sendPhoto(adminId, photo.file_id, {
        caption: orderText, parse_mode: 'HTML', ...adminOrderKeyboard(orderId, u.id)
      })
    } catch (e) { console.error('Admin xato:', e.message) }
  }
  ctx.session = { lang }
})

// ─── ADMIN ТАСДИҚ/РАД ───────────────────────────────
bot.action(/^adm_(done|reject)_(\d+)_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('❌')
  const [, action, orderId, userId] = ctx.match
  const order = await getOrder(orderId)
  if (!order) return ctx.answerCbQuery('Топилмади!')
  const lang = await getLang(parseInt(userId))

  if (action === 'done') {
    await updateOrderStatus(orderId, 'done')
    await bot.telegram.sendMessage(parseInt(userId),
      lang === 'tj'
        ? `✅ <b>Фармоиши №${orderId} иҷро шуд!</b>\n💎 <b>${order.package_name}</b> ба FF ID <code>${order.ff_id}</code> зачисленд!\n🎮 Бозӣ кунед! 🔥`
        : `✅ <b>Заказ №${orderId} выполнен!</b>\n💎 <b>${order.package_name}</b> зачислены на FF ID <code>${order.ff_id}</code>!\n🎮 Удачной игры! 🔥`,
      { parse_mode: 'HTML' }
    ).catch(() => {})
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || '') + '\n\n✅ ТАСДИҚ ШУД', { parse_mode: 'HTML' })
    await ctx.answerCbQuery('✅')
  } else {
    await updateOrderStatus(orderId, 'rejected')
    await bot.telegram.sendMessage(parseInt(userId),
      lang === 'tj'
        ? `❌ <b>Фармоиши №${orderId} рад шуд.</b>\nМуроҷиат: @jovidxon_dev`
        : `❌ <b>Заказ №${orderId} отклонён.</b>\nОбратитесь: @jovidxon_dev`,
      { parse_mode: 'HTML' }
    ).catch(() => {})
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || '') + '\n\n❌ РАД ШУД', { parse_mode: 'HTML' })
    await ctx.answerCbQuery('❌')
  }
})

// ─── СУХБАТРО БАСТАН ─────────────────────────────────
bot.action(/^close_chat_(\d+)$/, async (ctx) => {
  const lang = await getLangS(ctx)
  const targetId = parseInt(ctx.match[1])

  if (ctx.from.id === targetId) {
    ctx.session.step = null
    try {
      await ctx.editMessageText(lang === 'tj' ? '🔴 <b>Сухбат баста шуд.</b>' : '🔴 <b>Чат закрыт.</b>', { parse_mode: 'HTML', ...mainKb(lang) })
    } catch {
      await ctx.replyWithHTML(lang === 'tj' ? '🔴 <b>Сухбат баста шуд.</b>' : '🔴 <b>Чат закрыт.</b>', mainKb(lang))
    }
    for (const adminId of ADMIN_IDS) {
      await bot.telegram.sendMessage(adminId, `🔴 Истифодабаранда <code>${targetId}</code> сухбатро баст.`, { parse_mode: 'HTML' }).catch(() => {})
    }
  } else if (ADMIN_IDS.includes(ctx.from.id)) {
    const tLang = await getLang(targetId)
    await bot.telegram.sendMessage(targetId,
      tLang === 'tj' ? '🔴 <b>Admin сухбатро баст.</b>' : '🔴 <b>Admin закрыл чат.</b>',
      { parse_mode: 'HTML', ...mainKb(tLang) }
    ).catch(() => {})
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }) } catch {}
    await ctx.replyWithHTML(`✅ Сухбат <code>${targetId}</code> баста шуд.`)
  }
  await ctx.answerCbQuery()
})

// ─── ADMIN ҶАВОБ ТУГМАСИ ────────────────────────────
bot.action(/^reply_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery()
  ctx.session.step = `replying_to_${ctx.match[1]}`
  await ctx.replyWithHTML(`✏️ Ҷавоби худро ёзинг (<code>${ctx.match[1]}</code> учун):`)
  await ctx.answerCbQuery()
})

// ─── ПРОФИЛ ──────────────────────────────────────────
bot.action('my_profile', async (ctx) => {
  const lang = await getLangS(ctx)
  const orders = await getUserOrders(ctx.from.id)
  const done = orders.filter(o => o.status === 'done').length
  const text = lang === 'tj'
    ? `👤 <b>Профили ман</b>\n\n🆔 TG ID: <code>${ctx.from.id}</code>\n👤 Ном: <b>${ctx.from.first_name}</b>\n📦 Жами: <b>${orders.length}</b>\n✅ Иҷро: <b>${done}</b>\n⏳ Интизор: <b>${orders.length - done}</b>`
    : `👤 <b>Мой профиль</b>\n\n🆔 TG ID: <code>${ctx.from.id}</code>\n👤 Имя: <b>${ctx.from.first_name}</b>\n📦 Всего: <b>${orders.length}</b>\n✅ Выполнено: <b>${done}</b>\n⏳ Ожидает: <b>${orders.length - done}</b>`
  try { await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKb(lang) }) }
  catch { await ctx.replyWithHTML(text, backKb(lang)) }
  await ctx.answerCbQuery()
})

// ─── ТАЪРИХ ──────────────────────────────────────────
bot.action('history', async (ctx) => {
  const lang = await getLangS(ctx)
  const orders = await getUserOrders(ctx.from.id)
  if (!orders.length) {
    const text = lang === 'tj' ? '📋 Ҳоло харидорӣ надоред.' : '📋 У вас пока нет покупок.'
    try { await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKb(lang) }) }
    catch { await ctx.replyWithHTML(text, backKb(lang)) }
    return ctx.answerCbQuery()
  }
  const em = { pending: '⏳', done: '✅', rejected: '❌' }
  let text = lang === 'tj' ? '📋 <b>Таърихи харидҳо:</b>\n\n' : '📋 <b>История покупок:</b>\n\n'
  for (const o of orders) {
    text += `${em[o.status] || '•'} №${o.id} | ${o.package_name} | ${o.price} сом | ${String(o.created_at).slice(0,10)}\n`
  }
  try { await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKb(lang) }) }
  catch { await ctx.replyWithHTML(text, backKb(lang)) }
  await ctx.answerCbQuery()
})

// ─── ДАСТГИРӢ ────────────────────────────────────────
bot.action('support', async (ctx) => {
  const lang = await getLangS(ctx)
  ctx.session.step = 'waiting_support_msg'
  const text = lang === 'tj'
    ? `🆘 <b>Хидмати дастгирӣ</b>\n\n📝 Саволи худро ёзед!\nAdmin зуд ҷавоб медиҳад.\n\n⏰ 09:00 - 22:00\n👤 @jovidxon_dev`
    : `🆘 <b>Служба поддержки</b>\n\n📝 Напишите ваш вопрос!\nAdmin ответит быстро.\n\n⏰ 09:00 - 22:00\n👤 @jovidxon_dev`
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKb(lang) })
  } catch {
    await ctx.replyWithHTML(text, backKb(lang))
  }
  await ctx.answerCbQuery()
})

// ─── APK — 2 ТА ──────────────────────────────────────
bot.action('download_apk', async (ctx) => {
  const lang = await getLangS(ctx)
  const tj = lang === 'tj'
  const text = tj ? '📱 <b>APK Юклаш</b>\n\nКадом APK-ни юклаш истайсиз?' : '📱 <b>Скачать APK</b>\n\nКакой APK хотите скачать?'
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('💎 Алмаз TopUp APK', 'apk_1')],
    [Markup.button.callback('🎯 FreeFire Sensi APK', 'apk_2')],
    [Markup.button.callback(tj ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]
  ])
  try { await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb }) }
  catch { await ctx.replyWithHTML(text, kb) }
  await ctx.answerCbQuery()
})

bot.action('apk_1', async (ctx) => {
  const lang = await getLangS(ctx)
  await ctx.answerCbQuery()
  if (APK_FILE_1) {
    await ctx.replyWithDocument(APK_FILE_1, {
      caption: lang === 'tj' ? '💎 <b>Алмаз TopUp APK</b>\n\nНасб кунед ва алмос харед!' : '💎 <b>Алмаз TopUp APK</b>\n\nУстановите и покупайте алмазы!',
      parse_mode: 'HTML', ...backKb(lang)
    })
  } else {
    await ctx.replyWithHTML(lang === 'tj' ? '⏳ APK тайёрланмоқда...' : '⏳ APK готовится...', backKb(lang))
  }
})

bot.action('apk_2', async (ctx) => {
  const lang = await getLangS(ctx)
  await ctx.answerCbQuery()
  if (APK_FILE_2) {
    await ctx.replyWithDocument(APK_FILE_2, {
      caption: lang === 'tj' ? '🎯 <b>FreeFire Sensi APK</b>\n\nНасб кунед!' : '🎯 <b>FreeFire Sensi APK</b>\n\nУстановите!',
      parse_mode: 'HTML', ...backKb(lang)
    })
  } else {
    await ctx.replyWithHTML(lang === 'tj' ? '⏳ APK тайёрланмоқда...' : '⏳ APK готовится...', backKb(lang))
  }
})

// ─── ADMIN ПАНЕЛ ─────────────────────────────────────
async function showAdminPanel(ctx) {
  const s = await getStats()
  await ctx.replyWithHTML(
    `🛡 <b>Admin Панел</b>\n\n━━━━━━━━━━━━━━━\n📊 <b>Dashboard</b>\n👥 Харидорон: <b>${s.users}</b>\n✅ Иҷро: <b>${s.done}</b>\n⏳ Интизор: <b>${s.pending}</b>\n💰 Даромад: <b>${s.revenue} сомонӣ</b>\n━━━━━━━━━━━━━━━`,
    Markup.inlineKeyboard([
      [Markup.button.callback('⏳ Интизор фармоишҳо', 'adm_pending')],
      [Markup.button.callback('📊 Статистика', 'adm_stats')]
    ])
  )
}

bot.command('admin_panel', async (ctx) => {
  ctx.session.step = 'waiting_admin_pass'
  ctx.session.admin_attempts = 0
  await ctx.replyWithHTML('🔐 <b>Admin панел рамзини ворид кунед:</b>')
})

bot.action('adm_pending', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('❌')
  const { getPendingOrders } = require('./api')
  const orders = await getPendingOrders()
  if (!orders.length) { await ctx.replyWithHTML('✅ Интизор фармоиш йӯқ!'); return ctx.answerCbQuery() }
  let text = `⏳ <b>Интизор (${orders.length}):</b>\n\n`
  for (const o of orders) text += `🔹 №${o.id} | FF: <code>${o.ff_id}</code> | ${o.package_name} | ${o.price} сом\n`
  await ctx.replyWithHTML(text)
  await ctx.answerCbQuery()
})

bot.action('adm_stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('❌')
  const s = await getStats()
  await ctx.replyWithHTML(`📊 <b>Статистика</b>\n\n👥 Харидорон: <b>${s.users}</b>\n✅ Иҷро: <b>${s.done}</b>\n⏳ Интизор: <b>${s.pending}</b>\n💰 Даромад: <b>${s.revenue} сомонӣ</b>`)
  await ctx.answerCbQuery()
})

bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return
  const s = await getStats()
  await ctx.replyWithHTML(`📊 <b>Статистика</b>\n\n👥 Харидорон: <b>${s.users}</b>\n✅ Иҷро: <b>${s.done}</b>\n⏳ Интизор: <b>${s.pending}</b>\n💰 Даромад: <b>${s.revenue} сомонӣ</b>`)
})

bot.launch().then(() => console.log('✅ Bot ishga tushdi!'))
  .catch(err => console.error('❌ Xato:', err))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
