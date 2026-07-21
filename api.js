const fetch = require('node-fetch')

const API_URL = process.env.API_URL || 'http://jovidxondev-topup.atwebpages.com/api.php'
const API_KEY = process.env.API_KEY || 'ffbot_api_key_jovidxon_2026'

async function apiGet(action, params = {}) {
  const url = new URL(API_URL)
  url.searchParams.set('action', action)
  url.searchParams.set('key', API_KEY)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  try {
    const res = await fetch(url.toString())
    return await res.json()
  } catch (e) {
    console.error('API GET xato:', e.message)
    return { success: false }
  }
}

async function apiPost(action, data = {}) {
  const params = new URLSearchParams()
  params.set('action', action)
  params.set('key', API_KEY)
  for (const [k, v] of Object.entries(data)) {
    params.set(k, v)
  }
  try {
    const res = await fetch(API_URL, { method: 'POST', body: params })
    return await res.json()
  } catch (e) {
    console.error('API POST xato:', e.message)
    return { success: false }
  }
}

// ─── FOYDALANUVCHI ───────────────────────────────────
const saveUser = (telegramId, username, fullName, lang = 'ru') =>
  apiPost('save_user', { telegram_id: telegramId, username, full_name: fullName, lang })

const getLang = async (telegramId) => {
  const res = await apiGet('get_lang', { telegram_id: telegramId })
  return res.lang || 'ru'
}

const setLang = (telegramId, lang) =>
  apiPost('set_lang', { telegram_id: telegramId, lang })

// ─── PAKETLAR ────────────────────────────────────────
const getPackages = async () => {
  const res = await apiGet('get_packages')
  return res.packages || []
}

const getSettings = async () => {
  const res = await apiGet('get_settings')
  return res.settings || {}
}

// ─── BUYURTMALAR ─────────────────────────────────────
const createOrder = async (userId, ffId, ffName, packageId, packageName, price) => {
  const res = await apiPost('create_order', {
    user_id: userId, ff_id: ffId, ff_name: ffName,
    package_id: packageId, package_name: packageName, price
  })
  return { orderId: res.order_id || 0, queue: res.queue || 1 }
}

const setScreenshot = (orderId, fileId) =>
  apiPost('set_screenshot', { order_id: orderId, file_id: fileId })

const getOrder = async (orderId) => {
  const res = await apiGet('get_order', { order_id: orderId })
  return res.order || null
}

const updateOrderStatus = (orderId, status) =>
  apiPost('update_status', { order_id: orderId, status })

const getUserOrders = async (telegramId) => {
  const res = await apiGet('get_user_orders', { telegram_id: telegramId })
  return res.orders || []
}

const getStats = () => apiGet('get_stats')

const getPendingOrders = async () => {
  const res = await apiGet('get_pending')
  return res.orders || []
}

module.exports = {
  saveUser, getLang, setLang,
  getPackages, getSettings,
  createOrder, setScreenshot, getOrder,
  updateOrderStatus, getUserOrders,
  getStats, getPendingOrders
}
