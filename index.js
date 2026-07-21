require('dotenv').config()
const { Telegraf, session, Markup } = require('telegraf')
const axios = require('axios')

const {
  saveUser, getLang, setLang,
  getPackages, getSettings,
  createOrder, setScreenshot, getOrder,
  updateOrderStatus, getUserOrders, getStats
} = require('./api')

const { adminOrderKeyboard } = require('./keyboards')
const { t } = require('./locales')

const bot = new Telegraf(process.env.BOT_TOKEN || '')
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean)
const APK_FILE_ID = process.env.APK_FILE_ID || ''

bot.use(session())
bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {}
  return next()
})

// ─── FF NICKNAME TEKSHIRISH ──────────────────────────
async function checkFFAccount(playerId) {
  const regions = ['IND', 'SG', 'BD', 'ID', 'TH', 'MY', 'VN', 'PK']
  for (const region of regions) {
    try {
      const res = await axios.get(
        `https://www.hlgamingofficial.com/api/ff/?uid=${playerId}&region=${region}`,
        { timeout: 6000 }
      )
      if (res.data && res.data.nickname && !res.data.nickname.startsWith('Player_')) {
        return res.data.nickname
      }
    } catch {}
  }
  // Garena API ni ham sinab ko'ramiz
  try {
    const res = await axios.post(
      'https://shop.garena.my/api/auth/player_id_login',
      `player_id=${playerId}&app_id=100067&app_type=`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 6000 }
    )
    if (res.data && res.data.username) return res.data.username
  } catch {}
  return null
}

// ─── PAYMENT LINK ────────────────────────────────────
function payLink(price) {
  return `http://pay.expresspay.tj/?A=9762000000682707&s=${price}&c=&f1=133&FIELD2=&FIELD3=`
}

// ─── LANG ────────────────────────────────────────────
async function getLangSafe(ctx) {
  return ctx.session.lang || await getLang(ctx.from.id)
}

// ─── MAIN MENU KEYBOARD ──────────────────────────────
function mainMenu(lang) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💎 ' + (lang === 'tj' ? 'Алмос харидан' : 'Купить Алмазы'), 'buy_diamonds')],
    [
      Markup.button.callback(lang === 'tj' ? '👤 Профил' : '👤 Профиль', 'my_profile'),
      Markup.button.callback(lang === 'tj' ? '📋 Таърих' : '📋 История', 'history')
    ],
    [
      Markup.button.callback(lang === 'tj' ? '🆘 Дастгирӣ' : '🆘 Поддержка', 'support'),
      Markup.button.callback(lang === 'tj' ? '📱 APK Юклаш' : '📱 Скачать APK', 'download_apk')
    ],
    [Markup.button.callback(lang === 'tj' ? '🌐 Забон' : '🌐 Язык', 'change_lang')]
  ])
}

function backBtn(lang) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')]
  ])
}

// ─── /start ──────────────────────────────────────────
bot.start(async (ctx) => {
  ctx.session = {}
  const u = ctx.from
  await saveUser(u.id, u.username || '', u.first_name + (u.last_name ? ' ' + u.last_name : ''))
  await ctx.replyWithHTML(
    '🌐 <b>Выберите язык / Забонро интихоб кунед:</b>',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🇹🇯 Тоҷикӣ', 'lang_tj'),
        Markup.button.callback('🇷🇺 Русский', 'lang_ru')
      ]
    ])
  )
})

// ─── ZABONLAR ────────────────────────────────────────
bot.action(['lang_ru', 'lang_tj'], async (ctx) => {
  ctx.session = {}
  const lang = ctx.callbackQuery.data === 'lang_ru' ? 'ru' : 'tj'
  await setLang(ctx.from.id, lang)
  ctx.session.lang = lang
  await ctx.editMessageText(
    lang === 'tj' ? '✅ Забон: Тоҷикӣ' : '✅ Язык: Русский'
  )
  const welcome = lang === 'tj'
    ? `🔥 <b>Хуш омадед ба FF TopUp Bot!</b>\n\n💎 Алмос харидан осон ва зуд\n🇹🇯 Нарх бо сомонӣ\n⚡ Зуд ба аккаунт мерасад`
    : `🔥 <b>Добро пожаловать в FF TopUp Bot!</b>\n\n💎 Пополнение алмазов быстро и легко\n🇹🇯 Цены в сомони\n⚡ Мгновенное зачисление`
  await ctx.replyWithHTML(welcome, mainMenu(lang))
  await ctx.answerCbQuery()
})

bot.action('change_lang', async (ctx) => {
  ctx.session = {}
  await ctx.editMessageText(
    '🌐 <b>Выберите язык / Забонро интихоб кунед:</b>',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🇹🇯 Тоҷикӣ', 'lang_tj'),
        Markup.button.callback('🇷🇺 Русский', 'lang_ru')
      ]
    ])}
  )
  await ctx.answerCbQuery()
})

// ─── MAIN MENU ───────────────────────────────────────
bot.action('main_menu', async (ctx) => {
  ctx.session.step = null
  const lang = await getLangSafe(ctx)
  ctx.session.lang = lang
  try {
    await ctx.editMessageText(
      lang === 'tj' ? '🏠 <b>Менюи асосӣ</b>' : '🏠 <b>Главное меню</b>',
      { parse_mode: 'HTML', ...mainMenu(lang) }
    )
  } catch {
    await ctx.replyWithHTML(
      lang === 'tj' ? '🏠 <b>Менюи асосӣ</b>' : '🏠 <b>Главное меню</b>',
      mainMenu(lang)
    )
  }
  await ctx.answerCbQuery()
})

// ─── ALMOS XARID ─────────────────────────────────────
bot.action('buy_diamonds', async (ctx) => {
  const lang = await getLangSafe(ctx)
  ctx.session.lang = lang
  ctx.session.step = 'waiting_ff_id'
  const text = lang === 'tj'
    ? `🔥 <b>Free Fire ID-и худро ворид кунед:</b>\n\nМасалан: <code>708957035</code>\n\n📌 ID-ро дар бозӣ: <b>Профил → Copy ID</b> ёбед`
    : `🔥 <b>Введите ваш ID аккаунта Free Fire:</b>\n\nНапример: <code>708957035</code>\n\n📌 ID можно найти в игре: <b>Профиль → Скопировать ID</b>`
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')]])
  })
  await ctx.answerCbQuery()
})

// ─── MATN QAYTA ISHLASH ──────────────────────────────
bot.on('text', async (ctx) => {
  const lang = await getLangSafe(ctx)
  ctx.session.lang = lang
  const step = ctx.session.step

  // FF ID
  if (step === 'waiting_ff_id') {
    const ffId = ctx.message.text.trim()
    if (!/^\d{6,15}$/.test(ffId)) {
      return ctx.replyWithHTML(
        lang === 'tj' ? '❌ ID нодуруст! Рақамҳоро ворид кунед.' : '❌ Неверный ID! Введите только цифры.',
        Markup.inlineKeyboard([[Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')]])
      )
    }
    const msg = await ctx.replyWithHTML(lang === 'tj' ? '⏳ Аккаунт тафтиш карда мешавад...' : '⏳ Проверяем аккаунт...')
    const ffName = await checkFFAccount(ffId)

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {})

    if (!ffName) {
      return ctx.replyWithHTML(
        lang === 'tj'
          ? `❌ <b>Аккаунт ёфт нашуд!</b>\n\nID: <code>${ffId}</code>\n\nID-ро дуруст ворид кунед ва дубора кӯшиш кунед.`
          : `❌ <b>Аккаунт не найден!</b>\n\nID: <code>${ffId}</code>\n\nПроверьте ID и попробуйте снова.`,
        Markup.inlineKeyboard([
          [Markup.button.callback(lang === 'tj' ? '🔄 Дубора' : '🔄 Попробовать снова', 'buy_diamonds')],
          [Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')]
        ])
      )
    }

    ctx.session.ff_id = ffId
    ctx.session.ff_name = ffName
    ctx.session.step = 'waiting_package'

    await ctx.replyWithHTML(
      lang === 'tj'
        ? `✅ <b>Аккаунт ёфт шуд!</b>\n\n👤 Ном: <b>${ffName}</b>\n🆔 ID: <code>${ffId}</code>\n\n💎 Пакетро интихоб кунед:`
        : `✅ <b>Аккаунт найден!</b>\n\n👤 Никнейм: <b>${ffName}</b>\n🆔 ID: <code>${ffId}</code>\n\n💎 Выберите пакет:`,
      Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'tj' ? '✅ Дуруст — пакет интихоб кунам' : '✅ Верно — выбрать пакет', 'confirm_id')],
        [Markup.button.callback(lang === 'tj' ? '❌ ID нодуруст' : '❌ Неверный ID', 'buy_diamonds')],
        [Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')]
      ])
    )
    return
  }

  // DASTGIRI XABARI
  if (step === 'waiting_support_msg') {
    const userMsg = ctx.message.text
    const u = ctx.from
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(adminId,
          `📩 <b>Янги муроҷиат!</b>\n\n` +
          `👤 ${u.first_name} (@${u.username || 'йӯқ'})\n` +
          `🆔 ID: <code>${u.id}</code>\n\n` +
          `💬 Хабар: ${userMsg}`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(`✅ Ҷавоб бер (${u.id})`, `reply_${u.id}`)]
            ])
          }
        )
      } catch {}
    }
    ctx.session.step = null
    await ctx.replyWithHTML(
      lang === 'tj'
        ? '✅ <b>Муроҷиати шумо қабул шуд!</b>\n\nАдмин зуд ҷавоб медиҳад. 🙏'
        : '✅ <b>Ваше обращение принято!</b>\n\nАдмин скоро ответит. 🙏',
      mainMenu(lang)
    )
    return
  }

  // ADMIN JAVOB
  if (step && step.startsWith('replying_to_')) {
    const targetId = parseInt(step.replace('replying_to_', ''))
    try {
      await ctx.telegram.sendMessage(targetId,
        `📨 <b>Ҷавоби Admin:</b>\n\n${ctx.message.text}`,
        { parse_mode: 'HTML' }
      )
      await ctx.replyWithHTML('✅ Ҷавоб фиристода шуд!')
    } catch {
      await ctx.replyWithHTML('❌ Хабар фиристода нашуд!')
    }
    ctx.session.step = null
    return
  }
})

// ─── ID TASDIQLASH ───────────────────────────────────
bot.action('confirm_id', async (ctx) => {
  const lang = await getLangSafe(ctx)
  ctx.session.lang = lang
  const packages = await getPackages()
  ctx.session.packages = packages

  const rows = packages.map(pkg => {
    const name = lang === 'ru' ? pkg.name_ru : pkg.name_tj
    return [Markup.button.callback(`${name} — ${pkg.price} сом`, `pkg_${pkg.id}`)]
  })
  rows.push([Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')])

  await ctx.editMessageText(
    lang === 'tj' ? '💎 <b>Пакетро интихоб кунед:</b>' : '💎 <b>Выберите пакет алмазов:</b>',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) }
  )
  await ctx.answerCbQuery()
})

// ─── PAKET TANLASH ───────────────────────────────────
bot.action(/^pkg_(\d+)$/, async (ctx) => {
  const lang = await getLangSafe(ctx)
  ctx.session.lang = lang
  const pkgId = parseInt(ctx.match[1])
  const packages = ctx.session.packages || await getPackages()
  const pkg = packages.find(p => p.id == pkgId)
  if (!pkg) return ctx.answerCbQuery()

  const name = lang === 'ru' ? pkg.name_ru : pkg.name_tj
  ctx.session.package_id   = pkg.id
  ctx.session.package_name = name
  ctx.session.price        = pkg.price
  ctx.session.step         = 'waiting_screenshot'

  const cardNum = '9762000000682707'
  const cardOwner = 'Манижа.Х.З'
  const link = payLink(pkg.price)

  const text = lang === 'tj'
    ? `📦 <b>Интихоби шумо:</b>\n\n` +
      `💎 ${name}\n` +
      `💰 Нарх: <b>${pkg.price} сомонӣ</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💳 <b>Ба корта пардохт кунед:</b>\n\n` +
      `🏦 Рақами корта:\n<code>${cardNum}</code>\n\n` +
      `👤 Соҳиби корта: <b>${cardOwner}</b>\n\n` +
      `💵 Маблағ: <b>${pkg.price} сомонӣ</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `📸 Пас аз пардохт <b>скриншоти чек</b>ро фиристед!`
    : `📦 <b>Ваш выбор:</b>\n\n` +
      `💎 ${name}\n` +
      `💰 Цена: <b>${pkg.price} сомони</b>\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💳 <b>Оплатите на карту:</b>\n\n` +
      `🏦 Номер карты:\n<code>${cardNum}</code>\n\n` +
      `👤 Владелец: <b>${cardOwner}</b>\n\n` +
      `💵 Сумма: <b>${pkg.price} сомони</b>\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `📸 После оплаты отправьте <b>скриншот чека</b>!`

  // Kartani rasmini yuborish
  try {
    await ctx.deleteMessage()
  } catch {}

  await ctx.replyWithPhoto(
    { url: 'https://dcnext.tj/img/logo.png' },
    {
      caption: text,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url(
          lang === 'tj' ? `💳 DC Next орқали пардохт (${pkg.price} сом)` : `💳 Оплатить через DC Next (${pkg.price} сом)`,
          link
        )],
        [Markup.button.callback(lang === 'tj' ? '◀️ Бозгашт' : '◀️ Назад', 'confirm_id')],
        [Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')]
      ])
    }
  ).catch(async () => {
    await ctx.replyWithHTML(text,
      Markup.inlineKeyboard([
        [Markup.button.url(
          lang === 'tj' ? `💳 DC Next орқали пардохт (${pkg.price} сом)` : `💳 Оплатить через DC Next (${pkg.price} сом)`,
          link
        )],
        [Markup.button.callback(lang === 'tj' ? '◀️ Бозгашт' : '◀️ Назад', 'confirm_id')],
        [Markup.button.callback(lang === 'tj' ? '🏠 Асосӣ' : '🏠 Главное меню', 'main_menu')]
      ])
    )
  })

  await ctx.answerCbQuery()
})

// ─── SCREENSHOT ──────────────────────────────────────
bot.on('photo', async (ctx) => {
  const lang = await getLangSafe(ctx)
  ctx.session.lang = lang

  if (ctx.session.step !== 'waiting_screenshot') return

  const { ff_id, ff_name, package_id, package_name, price } = ctx.session
  if (!ff_id || !package_id) return

  const { orderId, queue } = await createOrder(
    ctx.from.id, ff_id, ff_name, package_id, package_name, price
  )

  const photo = ctx.message.photo.at(-1)
  await setScreenshot(orderId, photo.file_id)

  await ctx.replyWithHTML(
    lang === 'tj'
      ? `✅ <b>Фармоиши шумо қабул шуд!</b>\n\n` +
        `🆔 Фармоиш: <b>№${orderId}</b>\n` +
        `👤 Аккаунт: <b>${ff_name}</b>\n` +
        `🆔 FF ID: <code>${ff_id}</code>\n` +
        `💎 Пакет: <b>${package_name}</b>\n` +
        `💰 Маблағ: <b>${price} сомонӣ</b>\n` +
        `⏳ Навбат: <b>${queue}</b>-ум\n\n` +
        `🔄 Пардохт тафтиш карда мешавад. Алмос зуд мерасад!`
      : `✅ <b>Ваш заказ принят!</b>\n\n` +
        `🆔 Заказ: <b>№${orderId}</b>\n` +
        `👤 Аккаунт: <b>${ff_name}</b>\n` +
        `🆔 FF ID: <code>${ff_id}</code>\n` +
        `💎 Пакет: <b>${package_name}</b>\n` +
        `💰 Сумма: <b>${price} сомони</b>\n` +
        `⏳ Очередь: <b>${queue}</b>-й\n\n` +
        `🔄 Проверяем оплату. Алмазы скоро зачислятся!`,
    mainMenu(lang)
  )

  // ADMIN GA
  const u = ctx.from
  const adminText =
    `🆕 <b>Янги фармоиш №${orderId}</b>\n\n` +
    `👤 ${u.first_name} (@${u.username || 'йӯқ'})\n` +
    `🆔 TG: <code>${u.id}</code>\n` +
    `🔥 FF ID: <code>${ff_id}</code>\n` +
    `👤 FF: <b>${ff_name}</b>\n` +
    `💎 Пакет: <b>${package_name}</b>\n` +
    `💰 Маблағ: <b>${price} сомонӣ</b>\n` +
    `⏳ Навбат: <b>${queue}</b>`

  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendPhoto(adminId, photo.file_id, {
        caption: adminText,
        parse_mode: 'HTML',
        ...adminOrderKeyboard(orderId, u.id)
      })
    } catch (e) {
      console.error('Admin xato:', e.message)
    }
  }

  ctx.session = { lang }
})

// ─── ADMIN TASDIQLASH ────────────────────────────────
bot.action(/^adm_(done|reject)_(\d+)_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('❌ Рухсат йӯқ')
  const action = ctx.match[1]
  const orderId = ctx.match[2]
  const userId = parseInt(ctx.match[3])
  const order = await getOrder(orderId)
  if (!order) return ctx.answerCbQuery('Топилмади!')
  const lang = await getLang(userId)

  if (action === 'done') {
    await updateOrderStatus(orderId, 'done')
    await ctx.telegram.sendMessage(userId,
      lang === 'tj'
        ? `✅ <b>Фармоиши №${orderId} иҷро шуд!</b>\n\n💎 <b>${order.package_name}</b>\nАккаунти <b>${order.ff_name}</b>\nба зачисленд! Бозӣ кунед 🎮🔥`
        : `✅ <b>Заказ №${orderId} выполнен!</b>\n\n💎 <b>${order.package_name}</b>\nзачислены на аккаунт <b>${order.ff_name}</b>!\nУдачной игры 🎮🔥`,
      { parse_mode: 'HTML' }
    )
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || '') + '\n\n✅ ТАСДИҚ ШУД', { parse_mode: 'HTML' })
    await ctx.answerCbQuery('✅ Тасдиқ!')
  } else {
    await updateOrderStatus(orderId, 'rejected')
    await ctx.telegram.sendMessage(userId,
      lang === 'tj'
        ? `❌ <b>Фармоиши №${orderId} рад шуд.</b>\n\nМуроҷиат: @jovidxon_dev`
        : `❌ <b>Заказ №${orderId} отклонён.</b>\n\nОбратитесь: @jovidxon_dev`,
      { parse_mode: 'HTML' }
    )
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || '') + '\n\n❌ РАД ШУД', { parse_mode: 'HTML' })
    await ctx.answerCbQuery('❌ Рад!')
  }
})

// ─── ADMIN JAVOB ─────────────────────────────────────
bot.action(/^reply_(\d+)$/, async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery()
  const targetId = ctx.match[1]
  ctx.session.step = `replying_to_${targetId}`
  await ctx.replyWithHTML(`✏️ Ҷавоб ёзинг — фойдаланувчи <code>${targetId}</code> учун:`)
  await ctx.answerCbQuery()
})

// ─── PROFIL ──────────────────────────────────────────
bot.action('my_profile', async (ctx) => {
  const lang = await getLangSafe(ctx)
  const orders = await getUserOrders(ctx.from.id)
  const done = orders.filter(o => o.status === 'done').length
  const pending = orders.filter(o => o.status === 'pending').length

  await ctx.editMessageText(
    lang === 'tj'
      ? `👤 <b>Профили ман</b>\n\n` +
        `🆔 Telegram ID: <code>${ctx.from.id}</code>\n` +
        `👤 Ном: <b>${ctx.from.first_name}</b>\n` +
        `📦 Жами фармоишҳо: <b>${orders.length}</b>\n` +
        `✅ Иҷро шуда: <b>${done}</b>\n` +
        `⏳ Интизор: <b>${pending}</b>`
      : `👤 <b>Мой профиль</b>\n\n` +
        `🆔 Telegram ID: <code>${ctx.from.id}</code>\n` +
        `👤 Имя: <b>${ctx.from.first_name}</b>\n` +
        `📦 Всего заказов: <b>${orders.length}</b>\n` +
        `✅ Выполнено: <b>${done}</b>\n` +
        `⏳ Ожидает: <b>${pending}</b>`,
    { parse_mode: 'HTML', ...backBtn(lang) }
  )
  await ctx.answerCbQuery()
})

// ─── TARIX ───────────────────────────────────────────
bot.action('history', async (ctx) => {
  const lang = await getLangSafe(ctx)
  const orders = await getUserOrders(ctx.from.id)

  if (!orders.length) {
    await ctx.editMessageText(
      lang === 'tj' ? '📋 Ҳоло харидорӣ надоред.' : '📋 У вас пока нет покупок.',
      { parse_mode: 'HTML', ...backBtn(lang) }
    )
    return ctx.answerCbQuery()
  }

  const statusEmoji = { pending: '⏳', done: '✅', rejected: '❌' }
  let text = lang === 'tj' ? '📋 <b>Таърихи харидҳо:</b>\n\n' : '📋 <b>История покупок:</b>\n\n'
  for (const o of orders) {
    text += `${statusEmoji[o.status] || '•'} №${o.id} | ${o.package_name} | ${o.price} сом | ${o.created_at?.slice(0, 10)}\n`
  }

  await ctx.editMessageText(text, { parse_mode: 'HTML', ...backBtn(lang) })
  await ctx.answerCbQuery()
})

// ─── DASTGIRI ────────────────────────────────────────
bot.action('support', async (ctx) => {
  const lang = await getLangSafe(ctx)
  ctx.session.step = 'waiting_support_msg'
  await ctx.editMessageText(
    lang === 'tj'
      ? `🆘 <b>Хидмати дастгирӣ</b>\n\n` +
        `📝 Саволи худро ёзед — Admin зуд ҷавоб медиҳад!\n\n` +
        `⏰ Вақти кор: 09:00 - 22:00\n` +
        `👤 Мустақим: @jovidxon_dev`
      : `🆘 <b>Служба поддержки</b>\n\n` +
        `📝 Напишите ваш вопрос — Admin ответит быстро!\n\n` +
        `⏰ Время работы: 09:00 - 22:00\n` +
        `👤 Напрямую: @jovidxon_dev`,
    { parse_mode: 'HTML', ...backBtn(lang) }
  )
  await ctx.answerCbQuery()
})

// ─── APK YUKLAB OLISH ────────────────────────────────
bot.action('download_apk', async (ctx) => {
  const lang = await getLangSafe(ctx)
  await ctx.answerCbQuery()

  if (APK_FILE_ID) {
    await ctx.replyWithDocument(APK_FILE_ID, {
      caption: lang === 'tj'
        ? '📱 <b>FF TopUp Bot — Android APK</b>\n\nНасб кунед ва алмос харед!'
        : '📱 <b>FF TopUp Bot — Android APK</b>\n\nУстановите и покупайте алмазы!',
      parse_mode: 'HTML'
    })
  } else {
    await ctx.replyWithHTML(
      lang === 'tj'
        ? '📱 <b>APK тайёрланмоқда...</b>\n\nЗуд илова мешавад! @jovidxon_dev'
        : '📱 <b>APK готовится...</b>\n\nСкоро будет доступно! @jovidxon_dev',
      backBtn(lang)
    )
  }
})

// ─── ADMIN KOMANDALAR ────────────────────────────────
bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return
  const s = await getStats()
  await ctx.replyWithHTML(
    `📊 <b>Статистика</b>\n\n` +
    `👥 Харидорон: <b>${s.users}</b>\n` +
    `📦 Иҷро: <b>${s.done}</b>\n` +
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

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
