// 云函数：删除消息
const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID });

const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
  try {
    const { type, openid } = event;

    if (!type || !openid) {
      return {
        code: -1,
        message: '缺少必要参数',
        data: null
      };
    }

    const strategy = buildDeleteStrategy(type, openid);
    const result = await executeDelete(strategy, openid);

    return {
      code: 0,
      message: '操作成功',
      data: {
        affectedCount: result.removed + result.softDeleted,
        type: type,
        detail: {
          removed: result.removed,
          softDeleted: result.softDeleted
        }
      }
    };

  } catch (err) {
    console.error('deleteMessage 云函数错误:', err);
    return {
      code: -1,
      message: err.message || '删除消息失败',
      data: null
    };
  }
};

function buildDeleteStrategy(type, openid) {
  switch (type) {
    case 'all':
      return [
        { action: 'remove', condition: { type: 'pickup', openid }, description: '取货提醒' },
        { action: 'softDelete', condition: { type: 'newgoods' }, description: '上新通知' }
      ];

    case 'pickup':
      return [{ action: 'remove', condition: { type: 'pickup', openid }, description: '取货提醒' }];

    case 'newgoods':
      return [{ action: 'softDelete', condition: { type: 'newgoods' }, description: '上新通知' }];

    default:
      throw new Error(`不支持的消息类型: ${type}`);
  }
}

async function executeDelete(strategy, openid) {
  let removed = 0;
  let softDeleted = 0;

  for (const item of strategy) {
    if (item.action === 'remove') {
      const result = await db.collection('messages')
        .where(item.condition)
        .remove();
      removed += result.stats?.removed || 0;
    }

    if (item.action === 'softDelete') {
      const result = await db.collection('messages')
        .where(item.condition)
        .update({
          data: {
            deletedUsers: _.addToSet(openid)
          }
        });
      softDeleted += result.stats?.updated || 0;
    }
  }

  return { removed, softDeleted };
}
