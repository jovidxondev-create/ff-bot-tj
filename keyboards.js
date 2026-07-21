const { Markup } = require('telegraf')
const { t } = require('./locales')

const langKeyboard = () => Markup.inlineKeyboard([
  [
    Markup.button.callback('🇹🇯 Тоҷикӣ', 'lang_tj'),
    Markup.button.callback('🇷🇺 Русский', 'lang_ru')
  ]
])

const mainMenuKeyboard = (lang) => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btn_diamonds'),  'buy_diamonds')],
  [
    Markup.button.callback(t(lang, 'btn_profile'),   'my_profile'),
    Markup.button.callback(t(lang, 'btn_history'),   'history')
  ],
  [
    Markup.button.callback(t(lang, 'btn_support'),   'support'),
    Markup.button.callback(t(lang, 'btn_lang'),      'change_lang')
  ]
])

const confirmAccountKeyboard = (lang) => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btn_confirm'),   'confirm_id')],
  [Markup.button.callback(t(lang, 'btn_wrong_id'),  'wrong_id')],
  [Markup.button.callback(t(lang, 'btn_main_menu'), 'main_menu')]
])

const packagesKeyboard = (lang, packages) => {
  const buttons = packages.map(pkg => {
    const name = lang === 'ru' ? pkg.name_ru : pkg.name_tj
    // Тугмаҳоро дар як қатор мемонем, то намуди зебо дошта бошанд
    return [Markup.button.callback(`💎 ${name} ➖ 💰 ${pkg.price} сом`, `pkg_${pkg.id}`)]
  })
  buttons.push([Markup.button.callback(t(lang, 'btn_back'), 'main_menu')])
  return Markup.inlineKeyboard(buttons)
}

const paymentKeyboard = (lang) => Markup.inlineKeyboard([
  [Markup.button.url(t(lang, 'btn_pay_dc'), 'https://dcnext.tj')],
  [
    Markup.button.callback(t(lang, 'btn_back'),      'buy_diamonds'),
    Markup.button.callback(t(lang, 'btn_main_menu'), 'main_menu')
  ]
])

const backKeyboard = (lang) => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btn_main_menu'), 'main_menu')]
])

const adminOrderKeyboard = (orderId, userId) => Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ Тасдиқ кардан', `adm_done_${orderId}_${userId}`),
    Markup.button.callback('❌ Рад кардан', `adm_reject_${orderId}_${userId}`)
  ]
])

module.exports = {
  langKeyboard,
  mainMenuKeyboard,
  confirmAccountKeyboard,
  packagesKeyboard,
  paymentKeyboard,
  backKeyboard,
  adminOrderKeyboard
}
