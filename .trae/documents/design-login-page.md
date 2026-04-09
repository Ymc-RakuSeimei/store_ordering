# 设计初始用户登录页面

## 📋 需求分析

### 当前状态
- ❌ **没有独立的登录页面**
- 当前登录方式：在"我的"页面点击头像触发 `wx.getUserProfile`
- 用户首次进入时无引导，体验不完整
- 缺少品牌展示和用户协议等必要元素

### 目标效果
- ✅ 创建独立的登录/注册页面
- 首次进入自动跳转到登录页
- 登录成功后进入主界面（根据角色）
- 美观的UI设计，符合小程序规范
- 包含必要的法律声明和隐私政策

---

## 🎨 设计方案

### 页面定位
**文件路径**: `miniprogram/pages/login/login`

### UI 设计理念
1. **简洁现代** - 符合微信小程序设计规范
2. **品牌化** - 展示 MC_store 品牌形象
3. **流程清晰** - 一键授权，快速完成
4. **合规性** - 包含用户协议和隐私政策

---

## 📐 页面布局设计

```
┌─────────────────────────────┐
│                             │
│         [Logo / 品牌图]      │  ← 顶部：品牌展示区
│        MC Store             │
│      您的专属购物助手        │
│                             │
├─────────────────────────────┤
│                             │
│     ┌─────────────────┐     │
│     │   [默认头像]     │     │  ← 中部：用户信息区
│     │   (点击更换)     │     │
│     └─────────────────┘     │
│                             │
│    欢迎来到 MC Store        │
│    登录后享受更多服务        │
│                             │
├─────────────────────────────┤
│                             │
│   ┌───────────────────┐    │
│   │  微信一键登录      │    │  ← 底部：操作按钮区
│   └───────────────────┘    │
│                             │
│   ☑️ 我已阅读并同意          │
│     《用户协议》和《隐私政策》│
│                             │
└─────────────────────────────┘
```

### 配色方案
```css
主色调: #007AFF (微信蓝)
背景色: #FFFFFF
文字色: #333333 (主文字)
辅助色: #999999 (次要文字)
边框色: #E5E5E5
```

---

## 🔧 技术实现方案

### 文件结构
```
miniprogram/pages/login/
├── login.js       # 页面逻辑
├── login.wxml     # 页面结构
├── login.wxss     # 页面样式
└── login.json     # 页面配置
```

### 核心功能模块

#### 模块 1：页面初始化与检测
**功能**:
- 检测用户是否已登录（检查 openid 和 userInfo）
- 已登录 → 直接跳转到对应主页
- 未登录 → 显示登录界面

**代码逻辑**:
```javascript
onLoad() {
  this.checkLoginStatus();
},

async checkLoginStatus() {
  const app = getApp();

  // 检查是否有完整的用户信息
  if (app.globalData.userInfo && app.globalData.userInfo.openid) {
    // 已登录，跳转主页
    this.redirectToHome();
    return;
  }

  // 未登录，显示登录界面
  this.setData({ showLogin: true });
}
```

#### 模块 2：微信一键登录
**功能**:
- 调用 `wx.getUserProfile` 获取用户头像、昵称
- 调用 `saveUserInfo` 云函数保存用户信息
- 获取并存储 openid
- 登录成功后跳转

**代码逻辑**:
```javascript
async handleWechatLogin() {
  try {
    // 1. 获取用户授权信息
    const { userInfo } = await wx.getUserProfile({
      desc: '用于完善会员资料'
    });

    // 2. 保存到服务器
    await wx.cloud.callFunction({
      name: 'saveUserInfo',
      data: {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl
      }
    });

    // 3. 更新全局数据
    app.globalData.userInfo = { ...userInfo, openid };
    app.globalData.openid = openid;

    // 4. 跳转到主页
    this.redirectToHome();

  } catch (err) {
    console.error('登录失败:', err);
    wx.showToast({ title: '登录失败', icon: 'none' });
  }
}
```

#### 模块 3：角色判断与跳转
**功能**:
- 登录成功后获取用户角色
- customer → 跳转到顾客首页 (`/pages/customer/index/index`)
- merchant → 跳转到商家首页 (`/pages/merchant/index/index`)

**代码逻辑**:
```javascript
async redirectToHome() {
  const role = await getApp().getUserRole();

  if (role === 'merchant') {
    wx.redirectTo({ url: '/pages/merchant/index/index' });
  } else {
    wx.switchTab({ url: '/pages/customer/index/index' });
  }
}
```

#### 模块 4：用户协议与隐私政策
**功能**:
- 复选框：同意协议才能登录
- 点击链接查看完整内容
- 使用 `wx.showModal` 或独立页面展示

**实现方式**:
```html
<view class="agreement">
  <checkbox checked="{{agreed}}" bindchange="onAgreementChange" />
  <text>我已阅读并同意</text>
  <text class="link" bindtap="showUserAgreement">《用户协议》</text>
  <text>和</text>
  <text class="link" bindtap="showPrivacyPolicy">《隐私政策》</text>
</view>
```

---

## 📝 实施步骤

### 步骤 1：创建登录页面文件
创建 4 个文件：
- [login.js](miniprogram/pages/login/login.js)
- [login.wxml](miniprogram/pages/login/login.wxml)
- [login.wxss](miniprogram/pages/login/login.wxss)
- [login.json](miniprogram/pages/login/login.json)

### 步骤 2：注册页面到 app.json
在 `app.json` 的 pages 数组中添加：
```json
"pages/login/login"
```

### 步骤 3：修改 app.js 启动逻辑
在 `onLaunch` 中增加登录检测：
```javascript
onLaunch() {
  // 初始化云开发
  wx.cloud.init({...});

  // 检查是否需要登录
  this.checkAndRedirectToLogin();
}

checkAndRedirectToLogin() {
  const userInfo = wx.getStorageSync('userInfo');
  if (!userInfo || !userInfo.openid) {
    // 首次使用，跳转到登录页
    wx.redirectTo({ url: '/pages/login/login' });
  }
}
```

### 步骤 4：修改首页启动逻辑
在 `customer/index/index.js` 的 onLoad 中：
```javascript
onLoad() {
  // 检查登录状态
  if (!getApp().globalData.userInfo) {
    wx.redirectTo({ url: '/pages/login/login' });
    return;
  }

  // 正常加载首页数据
  this.loadData();
}
```

### 步骤 5：实现登录页面的完整功能
包括：
- ✅ UI 渲染（Logo、头像、按钮）
- ✅ 微信授权登录
- ✅ 用户协议勾选
- ✅ 登录状态持久化
- ✅ 角色判断与跳转
- ✅ 错误处理与提示

---

## 🎯 详细代码设计

### login.wxml 结构
```xml
<!-- 登录页面 -->
<view class="login-container">
  <!-- 顶部品牌区域 -->
  <view class="brand-section">
    <image class="logo" src="/images/logo.png" mode="aspectFit"></image>
    <text class="brand-name">MC Store</text>
    <text class="brand-slogan">您的专属购物助手</text>
  </view>

  <!-- 中部用户区域 -->
  <view class="user-section">
    <image
      class="avatar"
      src="{{userInfo.avatarUrl || '/images/default-avatar.png'}}"
      mode="aspectFill"
    ></image>
    <text class="welcome-text">欢迎来到 MC Store</text>
    <text class="sub-text">登录后享受更多服务</text>
  </view>

  <!-- 底部操作区域 -->
  <view class="action-section">
    <!-- 协议勾选 -->
    <view class="agreement" bindtap="toggleAgreement">
      <icon type="success" size="20" color="{{agreed ? '#07c160' : '#cccccc'}}"></icon>
      <text class="agreement-text">
        我已阅读并同意
        <text class="link" catchtap="showUserAgreement">《用户协议》</text>
        和
        <text class="link" catchtap="showPrivacyPolicy">《隐私政策》</text>
      </text>
    </view>

    <!-- 登录按钮 -->
    <button
      class="login-btn {{!agreed ? 'disabled' : ''}}"
      disabled="{{!agreed || loading}}"
      bindtap="handleLogin"
    >
      {{loading ? '登录中...' : '微信一键登录'}}
    </button>

    <!-- 暂时跳过（可选） -->
    <text class="skip-btn" bindtap="skipLogin">暂不登录，先逛逛</text>
  </view>
</view>
```

### login.js 逻辑
```javascript
Page({
  data: {
    userInfo: {},
    agreed: false,
    loading: false
  },

  onLoad() {
    this.checkAutoLogin();
  },

  async checkAutoLogin() {
    try {
      const app = getApp();
      if (app.globalData.userInfo && app.globalData.openid) {
        this.redirectToHome();
      } else {
        // 尝试从缓存恢复
        const cachedUser = wx.getStorageSync('userInfo');
        if (cachedUser && cachedUser.openid) {
          app.globalData.userInfo = cachedUser;
          app.globalData.openid = cachedUser.openid;
          this.redirectToHome();
        }
      }
    } catch (err) {
      console.error('自动登录检查失败:', err);
    }
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  async handleLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }

    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const { userInfo } = await wx.getUserProfile({
        desc: '用于完善会员资料'
      });

      const res = await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        }
      });

      if (res.result.success) {
        const app = getApp();
        app.globalData.userInfo = res.result.user;
        app.globalData.openid = res.result.user.openid;
        wx.setStorageSync('userInfo', res.result.user);

        this.redirectToHome();
      } else {
        throw new Error(res.result.message);
      }
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({
        title: err.errMsg?.includes('deny') ? '需要授权才能登录' : '登录失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  skipLogin() {
    wx.switchTab({ url: '/pages/customer/index/index' });
  },

  showUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '这里是用户协议的具体内容...',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  showPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '这里是隐私政策的具体内容...',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  async redirectToHome() {
    try {
      const role = await getApp().getUserRole();
      if (role === 'merchant') {
        wx.redirectTo({ url: '/pages/merchant/index/index' });
      } else {
        wx.switchTab({ url: '/pages/customer/index/index' });
      }
    } catch (err) {
      wx.switchTab({ url: '/pages/customer/index/index' });
    }
  }
});
```

### login.wxss 样式
```css
page {
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
  min-height: 100vh;
}

.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 60rpx 0;
  min-height: 100vh;
  box-sizing: border-box;
}

/* 品牌区域 */
.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 100rpx;
}

.logo {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 32rpx;
  border-radius: 40rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 122, 255, 0.15);
}

.brand-name {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.brand-slogan {
  font-size: 28rpx;
  color: #999;
}

/* 用户区域 */
.user-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 120rpx;
}

.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  margin-bottom: 32rpx;
  border: 6rpx solid #fff;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.welcome-text {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.sub-text {
  font-size: 26rpx;
  color: #999;
}

/* 操作区域 */
.action-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.agreement {
  display: flex;
  align-items: center;
  margin-bottom: 40rpx;
  padding: 0 20rpx;
}

.agreement-text {
  font-size: 24rpx;
  color: #666;
  margin-left: 12rpx;
}

.link {
  color: #007AFF;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #07c160;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 48rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
}

.login-btn.disabled {
  background: #cccccc;
  box-shadow: none;
}

.login-btn::after {
  border: none;
}

.skip-btn {
  margin-top: 40rpx;
  font-size: 26rpx;
  color: #999;
  text-decoration: underline;
}
```

---

## 🔄 与现有系统的集成点

### 需要修改的现有文件

| 文件 | 修改位置 | 修改内容 |
|------|---------|---------|
| **app.json** | pages 数组 | 添加 `"pages/login/login"` |
| **app.js** | onLaunch 方法 | 添加登录状态检测 |
| **customer/index/index.js** | onLoad 方法 | 添加未登录拦截 |
| **my.js** | handleLogin 方法 | 可选：改为跳转到登录页 |

### 数据流设计
```
用户打开小程序
    ↓
app.onLaunch()
    ↓
检查本地缓存 userInfo
    ↓
┌─ 有缓存 → 直接进入主页
│
└─ 无缓存 → 跳转到 /pages/login/login
              ↓
         用户点击"微信一键登录"
              ↓
         wx.getUserProfile() 获取授权
              ↓
         saveUserInfo 云函数保存
              ↓
         存储 userInfo 到 globalData + Storage
              ↓
         getUserRole() 获取角色
              ↓
    ┌─ merchant → 商家首页
    └─ customer → 顾客首页
```

---

## ⚠️ 注意事项

### 1. 微信 API 变更
- `wx.getUserProfile` 在基础库 2.27.1 以上可用
- 需要用户主动触发（不能在 onLoad 中调用）
- 每次调用都会弹出授权窗口

### 2. 合规要求
- 必须提供《用户协议》和《隐私政策》
- 不能强制授权（需提供"暂不登录"选项）
- 收集用户信息前必须获得明确同意

### 3. 兼容性处理
- 低版本微信可能不支持 getUserProfile
- 需要降级方案或提示升级

### 4. 测试建议
- 在真机上测试授权流程
- 测试取消授权后的处理
- 测试网络异常情况
- 测试不同角色的跳转

---

## 📊 预期成果

✅ **用户体验提升**
- 首次进入有明确的引导
- 登录流程简单直观
- 品牌形象更专业

✅ **功能完整性**
- 符合小程序审核规范
- 包含必要的法律声明
- 支持游客模式浏览

✅ **可维护性**
- 独立的登录模块
- 清晰的数据流
- 易于扩展（如手机号绑定）

---

## 🎉 实施优先级

**P0 - 必须（核心功能）**:
1. 创建登录页面 4 个文件
2. 实现微信一键登录
3. 注册到 app.json
4. 实现登录检测与跳转

**P1 - 重要（合规性）**:
5. 添加用户协议和隐私政策
6. 实现"暂不登录"选项
7. 错误处理优化

**P2 - 优化（体验）**:
8. Logo 和品牌素材
9. 动画效果
10. 加载状态优化
