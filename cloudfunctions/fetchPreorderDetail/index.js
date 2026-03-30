// 云函数 fetchPreorderDetail - 获取接龙详情
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { dragonId } = event

  if (!dragonId) {
    return { code: -1, message: '缺少接龙ID' }
  }

  try {
    // 1. 查询接龙基本信息
    const dragonRes = await db.collection('preorder_dragons').doc(dragonId).get()
    if (!dragonRes.data) {
      return { code: -1, message: '接龙不存在' }
    }

    const dragon = dragonRes.data

    // 2. 查询参与用户列表
    const participantsRes = await db.collection('preorder_participants')
      .where({ dragonId })
      .orderBy('joinTime', 'desc')
      .get()

    const participants = participantsRes.data.map(p => ({
      userId: p.userId,
      userName: p.userName || '微信用户',
      avatarUrl: p.avatarUrl || '',
      qty: p.qty,
      remark: p.remark || '',
      joinTime: formatTime(p.joinTime)
    }))

    // 3. 计算统计数据
    const participantCount = participants.length
    const totalQty = participants.reduce((sum, p) => sum + p.qty, 0)

    // 4. 返回数据
    return {
      code: 0,
      data: {
        dragon: {
          id: dragon._id,
          img: dragon.img || '',
          name: dragon.name || '',
          spec: dragon.spec || '',
          salePrice: dragon.salePrice || 0,
          costPrice: dragon.costPrice || 0,
          participantCount: participantCount,
          totalQty: totalQty,
          arrivalDate: dragon.arrivalDate || '',
          status: dragon.status || 'ongoing',
          createTime: formatTime(dragon.createTime)
        },
        participants: participants
      }
    }
  } catch (err) {
    console.error('获取接龙详情失败', err)
    return { code: -1, message: err.message || '获取失败' }
  }
}

/**
 * 格式化时间
 * @param {Date} date - 日期对象
 * @returns {string} 'YYYY-MM-DD HH:mm' 格式的字符串
 */
function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}
