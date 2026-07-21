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
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean)
const API_URL   = process.env.API_URL  || 'http://jovidxondev-topup.atwebpages.com'
const API_KEY   = process.env.API_KEY  || 'ffbot_api_key_jovidxon_2026'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026'
const CARD_IMG  = process.env.CARD_IMG || ''
const APK_FILE  = process.env.APK_FILE || ''

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

// ─── МЕНЮ МАТНЛАРИ ───────────────────────────────────
function menuText(lang) {
  return lang === 'tj'
    ? `🏠 <b>Менюи асосӣ</b>\n\n🔥 <b>FF Diamond TopUp TJK</b>\n💎 Алмос хариди зуд ва осон\n⚡ Зуд ба аккаунт мерасад`
    : `🏠 <b>Главное меню</b>\n\n🔥 <b>FF Diamond TopUp TJK</b>\n💎 Быстрое пополнение алмазов\n⚡ Мгновенное зачисление`
}

// ─── КЛАВИАТУРАЛАР ───────────────────────────────────
const langKb = () => Markup.inlineKeyboard([
  [
    Markup.button.callback('🇹🇯 Тоҷикӣ', 'lang_tj'),
    Markup.button.callback('🇷🇺 Русский', 'lang_ru')
  ]
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
      Markup.button.callback(tj ? '📱 APK' : '📱 APK', 'download_apk')
    ],
    [Markup.button.callback(tj ? '🌐 Забон иваз кунед' : '🌐 Сменить язык', 'change_lang')]
  ])
}

function backKb(lang) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]
  ])
}

// ─── АСОСИЙ МЕНЮ ҶАВОБИ ──────────────────────────────
async function sendMainMenu(ctx, lang) {
  const text = menuText(lang)
  const kb = mainKb(lang)
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb })
  } catch {
    await ctx.replyWithHTML(text, kb)
  }
}

// ─── /start ──────────────────────────────────────────
bot.start(async (ctx) => {
  ctx.session = {}
  const u = ctx.from
  await saveUser(u.id, u.username || '', `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}`)
  await ctx.replyWithHTML(
    '🌐 <b>Выберите язык / Забонро интихоб кунед:</b>',
    langKb()
  )
})

// ─── ЗАБОН ───────────────────────────────────────────
bot.action(['lang_ru', 'lang_tj'], async (ctx) => {
  ctx.session = {}
  const lang = ctx.callbackQuery.data === 'lang_tj' ? 'tj' : 'ru'
  await setLang(ctx.from.id, lang)
  ctx.session.lang = lang
  await ctx.editMessageText(
    lang === 'tj' ? '✅ Забон: Тоҷикӣ 🇹🇯' : '✅ Язык: Русский 🇷🇺'
  )
  await ctx.replyWithHTML(menuText(lang), mainKb(lang))
  await ctx.answerCbQuery()
})

bot.action('change_lang', async (ctx) => {
  ctx.session.step = null
  await ctx.editMessageText(
    '🌐 <b>Выберите язык / Забонро интихоб кунед:</b>',
    { parse_mode: 'HTML', ...langKb() }
  )
  await ctx.answerCbQuery()
})

// ─── АСОСИЙ МЕНЮ ─────────────────────────────────────
bot.action('main_menu', async (ctx) => {
  ctx.session.step = null
  const lang = await getLangS(ctx)
  await sendMainMenu(ctx, lang)
  await ctx.answerCbQuery()
})

// ─── АЛМОС ХАРИДИ ────────────────────────────────────
bot.action('buy_diamonds', async (ctx) => {
  const lang = await getLangS(ctx)
  ctx.session.step = 'waiting_ff_id'
  const text = lang === 'tj'
    ? `🔥 <b>Free Fire ID-и худро ворид кунед:</b>\n\nМасалан: <code>708957035</code>\n\n📌 ID-ро дар бозӣ:\n<b>Профил → Нусха гиред</b>`
    : `🔥 <b>Введите ваш ID аккаунта Free Fire:</b>\n\nНапример: <code>708957035</code>\n\n📌 ID можно найти в игре:\n<b>Профиль → Скопировать ID</b>`
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]])
    })
  } catch {
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]]))
  }
  await ctx.answerCbQuery()
})

// ─── МАТН ────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const lang = await getLangS(ctx)
  const step = ctx.session.step || ''
  const text = ctx.message.text.trim()

  // FF ID
  if (step === 'waiting_ff_id') {
    if (!/^\d{6,15}$/.test(text)) {
      return ctx.replyWithHTML(
        lang === 'tj' ? '❌ ID нодуруст! Танҳо рақамҳо.' : '❌ Неверный ID! Только цифры.',
        backKb(lang)
      )
    }
    ctx.session.ff_id = text
    ctx.session.step = 'waiting_package'
    const packages = await getPackages()
    ctx.session.packages = packages
    const rows = packages.map(p => {
      const name = lang === 'ru' ? p.name_ru : p.name_tj
      return [Markup.button.callback(`${name} — ${p.price} сом`, `pkg_${p.id}`)]
    })
    rows.push([Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')])
    return ctx.replyWithHTML(
      lang === 'tj'
        ? `✅ <b>ID қабул шуд!</b>\n🆔 ID: <code>${text}</code>\n\n💎 <b>Пакетро интихоб кунед:</b>`
        : `✅ <b>ID принят!</b>\n🆔 ID: <code>${text}</code>\n\n💎 <b>Выберите пакет алмазов:</b>`,
      Markup.inlineKeyboard(rows)
    )
  }

  // ДАСТГИРӢ ХАБАР
  if (step === 'waiting_support_msg') {
    const u = ctx.from
    ctx.session.step = 'in_support_chat'
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(adminId,
          `📩 <b>Янги муроҷиат!</b>\n👤 ${u.first_name} (@${u.username || 'йӯқ'})\n🆔 <code>${u.id}</code>\n\n💬 ${text}`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('💬 Ҷавоб бер', `reply_${u.id}`)],
              [Markup.button.callback('🔴 Сухбатро бастан', `close_chat_${u.id}`)]
            ])
          }
        )
      } catch {}
    }
    return ctx.replyWithHTML(
      lang === 'tj'
        ? '✅ Хабар қабул шуд! Admin зуд ҷавоб медиҳад.'
        : '✅ Сообщение принято! Admin скоро ответит.',
      Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'tj' ? '🔴 Сухбатро бастан' : '🔴 Закрыть чат', `close_chat_${ctx.from.id}`)]
      ])
    )
  }

  // СУХБАТ ДАВОМ
  if (step === 'in_support_chat') {
    const u = ctx.from
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(adminId,
          `💬 <b>${u.first_name}</b> (<code>${u.id}</code>):\n${text}`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('💬 Ҷавоб бер', `reply_${u.id}`)],
              [Markup.button.callback('🔴 Бастан', `close_chat_${u.id}`)]
            ])
          }
        )
      } catch {}
    }
    return
  }

  // ADMIN ҶАВОБ
  if (step && step.startsWith('replying_to_')) {
    const targetId = parseInt(step.replace('replying_to_', ''))
    const targetLang = await getLang(targetId)
    try {
      await ctx.telegram.sendMessage(targetId,
        `📨 <b>${targetLang === 'tj' ? 'Ҷавоби Admin' : 'Ответ Admin'}:</b>\n\n${text}`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(targetLang === 'tj' ? '🔴 Сухбатро бастан' : '🔴 Закрыть чат', `close_chat_${targetId}`)]
          ])
        }
      )
      await ctx.replyWithHTML('✅ Ҷавоб фиристода шуд!')
    } catch {
      await ctx.replyWithHTML('❌ Хабар фиристода нашуд!')
    }
    return
  }

  // ADMIN ПАНЕЛ РАМЗ
  if (step === 'waiting_admin_pass') {
    ctx.session.admin_attempts = (ctx.session.admin_attempts || 0) + 1
    if (text === ADMIN_PASSWORD) {
      ctx.session.step = null
      ctx.session.admin_attempts = 0
      return showAdminPanel(ctx)
    }
    const left = 3 - ctx.session.admin_attempts
    if (left <= 0) {
      ctx.session.step = null
      ctx.session.admin_attempts = 0
      return ctx.replyWithHTML('🔒 <b>3 маротиба хато! 10 дақиқа баста шуд.</b>')
    }
    return ctx.replyWithHTML(`❌ Рамз нодуруст! Боқӣ: <b>${left}</b> кӯшиш`)
  }
})

// ─── ID ТАСДИҚ ───────────────────────────────────────
bot.action('confirm_id', async (ctx) => {
  const lang = await getLangS(ctx)
  const packages = ctx.session.packages || await getPackages()
  ctx.session.packages = packages
  const rows = packages.map(p => {
    const name = lang === 'ru' ? p.name_ru : p.name_tj
    return [Markup.button.callback(`${name} — ${p.price} сом`, `pkg_${p.id}`)]
  })
  rows.push([Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')])
  try {
    await ctx.editMessageText(
      lang === 'tj' ? '💎 <b>Пакетро интихоб кунед:</b>' : '💎 <b>Выберите пакет алмазов:</b>',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) }
    )
  } catch {
    await ctx.replyWithHTML(
      lang === 'tj' ? '💎 <b>Пакетро интихоб кунед:</b>' : '💎 <b>Выберите пакет алмазов:</b>',
      Markup.inlineKeyboard(rows)
    )
  }
  await ctx.answerCbQuery()
})

// ─── ПАКЕТ ───────────────────────────────────────────
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

  const CARD = '9762000000682707'
  const OWNER = 'Манижа.Х.З'
  const link = payLink(pkg.price)

  const caption = lang === 'tj'
    ? `📦 <b>Интихоби шумо:</b>\n\n💎 ${name}\n💰 Нарх: <b>${pkg.price} сомонӣ</b>\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💳 <b>Ба корта пардохт кунед:</b>\n\n` +
      `🏦 Рақами корта:\n<code>${CARD}</code>\n` +
      `👤 Соҳиб: <b>${OWNER}</b>\n` +
      `💵 Маблағ: <b>${pkg.price} сомонӣ</b>\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `📸 Пас аз пардохт <b>скриншот</b> фиристед!`
    : `📦 <b>Ваш выбор:</b>\n\n💎 ${name}\n💰 Цена: <b>${pkg.price} сомони</b>\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💳 <b>Оплатите на карту:</b>\n\n` +
      `🏦 Номер карты:\n<code>${CARD}</code>\n` +
      `👤 Владелец: <b>${OWNER}</b>\n` +
      `💵 Сумма: <b>${pkg.price} сомони</b>\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `📸 После оплаты отправьте <b>скриншот</b>!`

  const kb = Markup.inlineKeyboard([
    [Markup.button.url(
      lang === 'tj' ? `💳 DC Next — ${pkg.price} сом` : `💳 Оплатить DC Next — ${pkg.price} сом`,
      link
    )],
    [Markup.button.callback(lang === 'tj' ? '◀️ Пакетҳо' : '◀️ Пакеты', 'confirm_id')],
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

// ─── СКРИНШОТ ────────────────────────────────────────
bot.on('photo', async (ctx) => {
  const lang = await getLangS(ctx)
  if (ctx.session.step !== 'waiting_screenshot') return

  const { ff_id, package_id, package_name, price } = ctx.session
  if (!ff_id || !package_id) return

  const { orderId, queue } = await createOrder(
    ctx.from.id, ff_id, ff_id, package_id, package_name, price
  )
  const photo = ctx.message.photo.at(-1)
  await setScreenshot(orderId, photo.file_id)

  await ctx.replyWithHTML(
    lang === 'tj'
      ? `✅ <b>Фармоиши шумо қабул шуд!</b>\n\n` +
        `🆔 №<b>${orderId}</b>\n` +
        `🔥 FF ID: <code>${ff_id}</code>\n` +
        `💎 <b>${package_name}</b>\n` +
        `💰 <b>${price} сомонӣ</b>\n` +
        `⏳ Навбат: <b>${queue}</b>-ум\n\n` +
        `🔄 Пардохт тафтиш карда мешавад!`
      : `✅ <b>Ваш заказ принят!</b>\n\n` +
        `🆔 №<b>${orderId}</b>\n` +
        `🔥 FF ID: <code>${ff_id}</code>\n` +
        `💎 <b>${package_name}</b>\n` +
        `💰 <b>${price} сомони</b>\n` +
        `⏳ Очередь: <b>${queue}</b>-й\n\n` +
        `🔄 Проверяем оплату!`,
    mainKb(lang)
  )

  const u = ctx.from
  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendPhoto(adminId, photo.file_id, {
        caption:
          `🆕 <b>Янги фармоиш №${orderId}</b>\n\n` +
          `👤 ${u.first_name} (@${u.username || 'йӯқ'})\n` +
          `🆔 TG: <code>${u.id}</code>\n` +
          `🔥 FF ID: <code>${ff_id}</code>\n` +
          `💎 <b>${package_name}</b>\n` +
          `💰 <b>${price} сомонӣ</b>\n` +
          `⏳ Навбат: <b>${queue}</b>`,
        parse_mode: 'HTML',
        ...adminOrderKeyboard(orderId, u.id)
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
    await ctx.telegram.sendMessage(parseInt(userId),
      lang === 'tj'
        ? `✅ <b>Фармоиши №${orderId} иҷро шуд!</b>\n💎 <b>${order.package_name}</b> ба FF ID <code>${order.ff_id}</code> зачисленд!\n🎮 Бозӣ кунед! 🔥`
        : `✅ <b>Заказ №${orderId} выполнен!</b>\n💎 <b>${order.package_name}</b> зачислены на FF ID <code>${order.ff_id}</code>!\n🎮 Удачной игры! 🔥`,
      { parse_mode: 'HTML' }
    ).catch(() => {})
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || '') + '\n\n✅ ТАСДИҚ ШУД', { parse_mode: 'HTML' })
    await ctx.answerCbQuery('✅')
  } else {
    await updateOrderStatus(orderId, 'rejected')
    await ctx.telegram.sendMessage(parseInt(userId),
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
  const isAdmin = ADMIN_IDS.includes(ctx.from.id)

  if (ctx.from.id === targetId) {
    ctx.session.step = null
    try {
      await ctx.editMessageText(
        lang === 'tj' ? '🔴 <b>Сухбат баста шуд.</b>' : '🔴 <b>Чат закрыт.</b>',
        { parse_mode: 'HTML', ...mainKb(lang) }
      )
    } catch {
      await ctx.replyWithHTML(
        lang === 'tj' ? '🔴 <b>Сухбат баста шуд.</b>' : '🔴 <b>Чат закрыт.</b>',
        mainKb(lang)
      )
    }
    for (const adminId of ADMIN_IDS) {
      await ctx.telegram.sendMessage(adminId, `🔴 Истифодабаранда <code>${targetId}</code> сухбатро баст.`, { parse_mode: 'HTML' }).catch(() => {})
    }
  } else if (isAdmin) {
    const tLang = await getLang(targetId)
    await ctx.telegram.sendMessage(targetId,
      tLang === 'tj'
        ? '🔴 <b>Admin сухбатро баст.</b>\nДубора муроҷиат карда метавонед.'
        : '🔴 <b>Admin закрыл чат.</b>\nМожете обратиться снова.',
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
  await ctx.replyWithHTML(`✏️ Ҷавоби худро ёзинг барои ID <code>${ctx.match[1]}</code>:`)
  await ctx.answerCbQuery()
})

// ─── ПРОФИЛ ──────────────────────────────────────────
bot.action('my_profile', async (ctx) => {
  const lang = await getLangS(ctx)
  const orders = await getUserOrders(ctx.from.id)
  const done = orders.filter(o => o.status === 'done').length
  const pending = orders.filter(o => o.status === 'pending').length
  const text = lang === 'tj'
    ? `👤 <b>Профили ман</b>\n\n🆔 Telegram ID: <code>${ctx.from.id}</code>\n👤 Ном: <b>${ctx.from.first_name}</b>\n📦 Жами: <b>${orders.length}</b>\n✅ Иҷро: <b>${done}</b>\n⏳ Интизор: <b>${pending}</b>`
    : `👤 <b>Мой профиль</b>\n\n🆔 Telegram ID: <code>${ctx.from.id}</code>\n👤 Имя: <b>${ctx.from.first_name}</b>\n📦 Всего: <b>${orders.length}</b>\n✅ Выполнено: <b>${done}</b>\n⏳ Ожидает: <b>${pending}</b>`
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKb(lang) })
  } catch {
    await ctx.replyWithHTML(text, backKb(lang))
  }
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
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]])
    })
  } catch {
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback(lang === 'tj' ? '🏠 Менюи асосӣ' : '🏠 Главное меню', 'main_menu')]]))
  }
  await ctx.answerCbQuery()
})

// ─── APK ─────────────────────────────────────────────
bot.action('download_apk', async (ctx) => {
  const lang = await getLangS(ctx)
  await ctx.answerCbQuery()
  if (APK_FILE) {
    await ctx.replyWithDocument(APK_FILE, {
      caption: lang === 'tj' ? '📱 <b>FF TopUp Bot APK</b>' : '📱 <b>FF TopUp Bot APK</b>',
      parse_mode: 'HTML'
    })
  } else {
    const text = lang === 'tj' ? '📱 APK тайёрланмоқда... @jovidxon_dev' : '📱 APK готовится... @jovidxon_dev'
    try { await ctx.editMessageText(text, { parse_mode: 'HTML', ...backKb(lang) }) }
    catch { await ctx.replyWithHTML(text, backKb(lang)) }
  }
})

// ─── ADMIN ПАНЕЛ ─────────────────────────────────────
async function showAdminPanel(ctx) {
  const s = await getStats()
  await ctx.replyWithHTML(
    `🛡 <b>Admin Панел</b>\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    `📊 <b>Dashboard</b>\n` +
    `👥 Харидорон: <b>${s.users}</b>\n` +
    `✅ Иҷро: <b>${s.done}</b>\n` +
    `⏳ Интизор: <b>${s.pending}</b>\n` +
    `💰 Даромад: <b>${s.revenue} сомонӣ</b>\n` +
    `━━━━━━━━━━━━━━━`,
    Markup.inlineKeyboard([
      [Markup.button.callback('⏳ Интизор фармоишҳо', 'adm_pending')],
      [Markup.button.callback('📊 Статистика', 'adm_stats')]
    ])
  )
}

bot.command('admin_panel', async (ctx) => {
  ctx.session.step = 'waiting_admin_pass'
  ctx.session.admin_attempts = 0
  await ctx.replyWithHTML('🔐 <b>Рамзро ворид кунед:</b>')
})

bot.action('adm_pending', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('❌')
  const { getPendingOrders } = require('./api')
  const orders = await getPendingOrders()
  if (!orders.length) {
    await ctx.replyWithHTML('✅ Интизор фармоиш йӯқ!')
    return ctx.answerCbQuery()
  }
  let text = `⏳ <b>Интизор (${orders.length}):</b>\n\n`
  for (const o of orders) {
    text += `🔹 №${o.id} | FF: <code>${o.ff_id}</code> | ${o.package_name} | ${o.price} сом\n`
  }
  await ctx.replyWithHTML(text)
  await ctx.answerCbQuery()
})

bot.action('adm_stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return ctx.answerCbQuery('❌')
  const s = await getStats()
  await ctx.replyWithHTML(
    `📊 <b>Статистика</b>\n\n👥 Харидорон: <b>${s.users}</b>\n✅ Иҷро: <b>${s.done}</b>\n⏳ Интизор: <b>${s.pending}</b>\n💰 Даромад: <b>${s.revenue} сомонӣ</b>`
  )
  await ctx.answerCbQuery()
})

bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return
  const s = await getStats()
  await ctx.replyWithHTML(
    `📊 <b>Статистика</b>\n\n👥 Харидорон: <b>${s.users}</b>\n✅ Иҷро: <b>${s.done}</b>\n⏳ Интизор: <b>${s.pending}</b>\n💰 Даромад: <b>${s.revenue} сомонӣ</b>`
  )
})

bot.launch().then(() => console.log('✅ Bot ishga tushdi!'))
  .catch(err => console.error('❌ Xato:', err))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
