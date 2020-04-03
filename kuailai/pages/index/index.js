//index.js
//获取应用实例
var app = getApp()
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')
// polyfill: async/await
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'
var util = require('../../utils/util.js')
var config = require('../../config');

// 状态管理，未绑定在wxml中的变量，减少setData导致的不必要渲染性能消耗
var store = {
  page: 0
}

Page({
  data: {
    headerH: 68,
    items: [],
    loadNextPage: false,
    isEnd: false,
    hideLoginLayer: true,
    hideGoRoomLayer: true,
    goRoomLayerInfo: {},
    hideDownBtn: true,
  },
  onLoad(query) {
    util.debug('query:', query)
    // 获取推广渠道id是否存在
    if (query.channel) {
      config.headerInfo.channel = query.channel
    }
  },

  onHeaderLoad(e) {
    this.setData({
      headerH: e.detail.headerH
    })
  },
  goRoom(e) {
    wx.showLoading({
      title: "跳转中",
      mask: 'true'
    })
    util.debug('goRoom:', e)
    let params = e.currentTarget.dataset
    wx.navigateTo({
      url: `/room/index/index?mid=${params.mid}&videourl=${params.videourl}&headPic=${params.headpic}`
    })
    wx.hideLoading()

    // 隐藏引导进房间弹框
    this.setData({
      hideGoRoomLayer: true
    })
  },
  onReady() {
    wx.hideToast()
    wx.startPullDownRefresh()
    // 是否隐藏下载 0不隐藏 1隐藏
    if (app.globalData.mode === 1) {
      this.setData({
        hideDownBtn: true
      })
    } else {
      this.setData({
        hideDownBtn: false
      })
    }
  },
  onShow() {
    if (app.globalData.isLogin && !this.data.hideLoginLayer) {
      // 已经登录
      this.setData({
        hideLoginLayer: true
      })
    }
  },
  async onPullDownRefresh() {
    store = {
      page: 0
    }
    this.setData({
      isEnd: false
    })
    await this.getList()
    // 停止下拉动作
    wx.stopPullDownRefresh()

    // 初始化登录提示、进入房间提示
    this.loopCheckToInitLayer()
  },
  onReachBottom() {
    if (this.data.isEnd || this.data.loadNextPage) return

    store.page++
    this.setData({
      loadNextPage: true
    })
    this.getList()
  },
  /*分享*/
  onShareAppMessage(res) {
    return {
      title: '快来直播秀',
      path: '/pages/index/index'
    }
  },

  getList() {
    let that = this
    // 默认未登录，获取热门列表
    let type = 1

    if (app.globalData.isLogin) {
      // 已经登录, 获取推荐列表
      type = 2
    }
    // 加载中
    this.setData({
      loadNextPage: true
    })

    qcloud.request({
      url: '/index/list',
      data: {
        type,
        page: store.page,
        size: 10
      },
      success: function (res) {
        util.debug('index items:', res)
        that.setData({
          loadNextPage: false
        })

        if (res.data.data.length == 0 && res.data.errno == 0) {
          that.setData({ isEnd: true })
          return
        }

        if (store.page == 0) {
          // 首页，下拉加载更多时
          that.setData({
            items: res.data.data
          })
        } else {
          that.setData({
            items: that.data.items.concat(res.data.data)
          })
        }
      },
      fail: function (err) {
        wx.showToast({
          title: `获取列表失败：${err.errMsg}`,
          icon: 'none',
          duration: 8000
        })
      }
    });
  },

  loopCheckToInitLayer() {
    let that = this;

    (function loop() {
      if (that.data.items.length == 0) {
        setTimeout(() => {
          loop()
        }, 100)
      } else {
        that.initHintLayer()
      }
    })()
  },

  initHintLayer() {
    let that = this
    wx.getStorage({
      key: 'isOlder',
      success(res) {
        // 看做老用户
        console.log('storage success: ', res)
        setTimeout(function () {
          if (!app.globalData.isLogin) {
            that.setData({
              hideLoginLayer: false
            })
          }
        }, 5000)
      },
      fail(res) {
        // 看做新用户
        console.log('storage fail: ', res)
        wx.setStorage({
          'key': 'isOlder',
          'data': 1
        })
        that.showGoRoomLayer()
      }
    })
  },
  showGoRoomLayer() {
    let random = parseInt(Math.random() * 4)

    this.setData({
      goRoomLayerInfo: this.data.items[random],
      hideGoRoomLayer: false
    })
  },

  onLoginLayerClose() {
    this.setData({
      'hideLoginLayer': true
    })
  },

  onUserLogined() {
    this.setData({
      'hideLoginLayer': true
    })
  },

  closeGoRoomLayer() {
    this.setData({
      'hideGoRoomLayer': true
    })
  }

})
