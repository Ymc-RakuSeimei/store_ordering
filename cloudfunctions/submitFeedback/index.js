// 云函数：submitFeedback
// 目的：提交用户反馈和售后申请
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

function formatDate(dateValue) {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 接收参数
    const { type, content, rating, orderId, orderNo, goodsId, goodsName, afterSaleType, reason, images } = event;

    // 验证必要参数
    if (!openid) {
      return {
        success: false,
        message: '缺少用户标识',
      };
    }

    let feedbackData;
    let result;

    if (type === '售后申请') {
      // 售后申请
      if (!orderId || !orderNo || !afterSaleType || !reason) {
        return {
          success: false,
          message: '缺少必要的售后信息',
        };
      }

      feedbackData = {
        openid: openid,
        type: type,
        orderId: orderId,
        orderNo: orderNo,
        goodsId: goodsId,
        goodsName: goodsName,
        afterSaleType: afterSaleType,
        reason: reason.trim(),
        images: images || [],
        status: '待处理',
        messages: [
          {
            role: 'customer',
            content: reason.trim(),
            time: formatDate(new Date())
          }
        ],
        updatedAt: new Date(),
      };

      // 先检查是否有同一订单的售后申请
      const existingRecord = await db.collection('feedbacks').where({
        openid: openid,
        orderId: orderId,
        type: '售后申请'
      }).get();
      
      let targetRecord = null;
      if (existingRecord.data && existingRecord.data.length > 0) {
        // 在同一订单的记录中找相同商品的
        for (let i = 0; i < existingRecord.data.length; i++) {
          const record = existingRecord.data[i];
          if (record.goodsId === goodsId) {
            targetRecord = record;
            break;
          }
        }
      }

      if (targetRecord) {
        // 如果存在，更新记录（不更新createdAt）
        await db.collection('feedbacks').doc(targetRecord._id).update({
          data: feedbackData
        });
        // 获取更新后的数据
        const feedback = await db.collection('feedbacks').doc(targetRecord._id).get();
        return {
          success: true,
          message: '更新成功',
          data: feedback.data,
        };
      } else {
        // 如果不存在，新增记录
        feedbackData.createdAt = new Date();
        result = await db.collection('feedbacks').add({
          data: feedbackData
        });
      }
    } else {
      // 意见反馈
      if (!orderId || !orderNo) {
        return {
          success: false,
          message: '缺少订单信息',
        };
      }
      
      if (!content || content.trim() === '') {
        return {
          success: false,
          message: '反馈内容不能为空',
        };
      }
      
      // 检查该订单是否已经提交过意见反馈
      const existingFeedback = await db.collection('feedbacks').where({
        openid: openid,
        orderId: orderId,
        type: '意见反馈'
      }).get();
      
      if (existingFeedback.data && existingFeedback.data.length > 0) {
        return {
          success: false,
          message: '该订单已提交过意见反馈，请勿重复提交',
        };
      }

      feedbackData = {
        openid: openid,
        type: type || '意见反馈',
        orderId: orderId,
        orderNo: orderNo,
        goodsId: goodsId || '',
        goodsName: goodsName || '',
        content: content.trim(),
        rating: rating || 0,
        images: images || [],
        status: '待处理',
        messages: [
          {
            role: 'customer',
            content: content.trim(),
            time: formatDate(new Date())
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 意见反馈新增
      result = await db.collection('feedbacks').add({
        data: feedbackData
      });
    }

    // 如果是新增的，获取完整的反馈信息
    if (result) {
      const feedback = await db.collection('feedbacks').doc(result._id).get();
      return {
        success: true,
        message: '提交成功',
        data: feedback.data,
      };
    }
  } catch (err) {
    console.error('submitFeedback云函数错误', err);
    return {
      success: false,
      message: err.message || '提交失败',
    };
  }
};