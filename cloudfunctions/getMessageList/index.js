// 云函数：getMessageList
const cloud = require('wx-server-sdk');

cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const limit = Number.isNaN(Number(event.limit)) ? 30 : Math.max(1, Math.min(100, Number(event.limit)));
    const page = Number.isNaN(Number(event.page)) ? 0 : Math.max(0, Number(event.page));
    const type = event.type || '';
    const openid = event.openid;
    const markRead = event.markRead;

    if (markRead && openid) {
      try {
        await db.collection('messages').where({
          _id: markRead
        }).update({
          data: {
            readUsers: db.command.addToSet(openid),
            readAt: new Date()
          }
        });
      } catch (markErr) {
        console.error('标记消息已读失败:', markErr);
      }
    }

    const filter = {};

    if (type) {
      filter.type = type;
    }

    let query = db.collection('messages');

    if (openid) {
      if (type && type !== 'newgoods') {
        filter.openid = openid;
      } else if (!type) {
        query = query.where(
          db.command.or([
            { openid: openid },
            buildNewGoodsNotDeletedCondition(openid)
          ])
        );
      } else if (type === 'newgoods') {
        filter.type = type;
        Object.assign(filter, buildNotDeletedFilter(openid));
      }
    }

    let items;
    try {
      if (Object.keys(filter).length > 0) {
        query = query.where(filter);
      }
      items = await query
        .limit(limit)
        .get();
    } catch (err) {
      console.error('查询失败:', err);
      items = { data: [] };
    }

    let total = -1;
    if (page === 0) {
      try {
        const countResult = await db.collection('messages').where(filter).count();
        total = countResult.total;
      } catch (countErr) {
        console.error('获取消息总数失败:', countErr);
        total = -1;
      }
    }

    const processedData = (items.data || []).map(item => {
      const isRead = openid && item.readUsers && item.readUsers.includes(openid);
      return {
        ...item,
        isRead: isRead
      };
    });

    return {
      code: 0,
      message: 'ok',
      data: processedData,
      page,
      limit,
      total,
    };
  } catch (err) {
    console.error('getMessageList云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取消息列表失败',
      data: [],
    };
  }
};

function buildNewGoodsNotDeletedCondition(openid) {
  return _.and([
    { type: 'newgoods' },
    _.or([
      { deletedUsers: _.nin([openid]) },
      { deletedUsers: _.exists(false) }
    ])
  ]);
}

function buildNotDeletedFilter(openid) {
  return {
    deletedUsers: _.or([
      _.nin([openid]),
      _.exists(false)
    ])
  };
}
