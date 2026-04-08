// 云函数：创建消息通知
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { type, title, content, productId } = event;

    if (!type || !content) {
      return {
        code: -1,
        message: '缺少必要参数'
      };
    }

    const messageData = {
      type: type,
      title: title || '',
      content: content,
      productId: productId || '',
      readUsers: [],
      deletedUsers: [],
      createdAt: new Date()
    };

    const result = await db.collection('messages').add({
      data: messageData
    });

    return {
      code: 0,
      message: '创建消息成功',
      data: {
        messageId: result._id
      }
    };
  } catch (error) {
    console.error('创建消息失败:', error);
    return {
      code: -1,
      message: '创建消息失败'
    };
  }
};
