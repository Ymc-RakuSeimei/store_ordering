// 云函数：getOpenId
// 目的：获取用户的 openid
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    // 获取用户信息
    const wxContext = cloud.getWXContext();
    
    return {
      code: 0,
      message: 'ok',
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
    };
  } catch (err) {
    console.error('getOpenId云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取 openid 失败',
      openid: null,
    };
  }
};