// 云函数：getPickupCode
// 目的：管理用户的取货码，提供根据openid获取取货码和根据取货码获取openid的功能
const cloud = require('wx-server-sdk');

cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

// 生成6位数字取货码
// 基于openid生成6位数字取货码
function generateSixDigitCode(openid) {
  // 使用openid生成一个哈希值
  let hash = 0;
  for (let i = 0; i < openid.length; i++) {
    const char = openid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // 将哈希值转换为6位数字
  const code = Math.abs(hash) % 900000 + 100000;
  return code.toString();
}

// 检查取货码是否已存在
async function isCodeExists(db, code) {
  const result = await db.collection('users').where({ pickupCode: code }).get();
  return result.data.length > 0;
}

// 生成唯一的取货码
async function generateUniqueCode(db, openid) {
  // 首先基于openid生成一个确定性的取货码
  let code = generateSixDigitCode(openid);
  let attempts = 0;
  const maxAttempts = 10;

  // 检查是否已存在，如果存在则添加一个小的随机数
  while (await isCodeExists(db, code) && attempts < maxAttempts) {
    // 添加一个小的随机数，确保唯一性
    const random = Math.floor(Math.random() * 100);
    code = ((parseInt(code) + random) % 900000 + 100000).toString();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('生成唯一取货码失败');
  }

  return code;
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const { openid, pickupCode } = event;

  try {
    // 场景1：根据openid获取取货码
    if (openid) {
      // 查询用户集合中是否有取货码
      const userResult = await db.collection('users').where({ openid }).get();

      if (userResult.data.length > 0) {
        if (userResult.data[0].pickupCode) {
          // 已有取货码，直接返回
          return {
            code: 0,
            data: {
              pickupCode: userResult.data[0].pickupCode,
              openid: userResult.data[0].openid
            }
          };
        } else {
          // 生成新的唯一取货码
          const newCode = await generateUniqueCode(db, openid);

          // 更新用户集合
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          while (retryCount < maxRetries && !success) {
            try {
              await db.collection('users').where({ openid }).update({
                data: {
                  pickupCode: newCode
                }
              });
              success = true;
            } catch (err) {
              retryCount++;
              console.error(`更新用户取货码失败 (尝试 ${retryCount}/${maxRetries})`, err);
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
              }
            }
          }

          if (!success) {
            console.error('更新用户取货码最终失败，超过最大重试次数');
          }

          return {
            code: 0,
            data: {
              pickupCode: newCode,
              openid
            }
          };
        }
      } else {
        return {
          code: -1,
          message: '用户不存在'
        };
      }
    }

    // 场景2：根据取货码获取openid
    else if (pickupCode) {
      const result = await db.collection('users').where({ pickupCode }).get();

      if (result.data.length > 0) {
        return {
          code: 0,
          data: {
            pickupCode: result.data[0].pickupCode,
            openid: result.data[0].openid
          }
        };
      } else {
        return {
          code: -1,
          message: '取货码不存在'
        };
      }
    }

    // 缺少必要参数
    else {
      return {
        code: -1,
        message: '缺少必要参数'
      };
    }

  } catch (err) {
    console.error('取货码管理失败:', err);
    return {
      code: -1,
      message: err.message || '操作失败'
    };
  }
};