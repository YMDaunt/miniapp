// pages/rank/rank.js
const app = getApp()
const qcloud = require('../../vendor/wafer2-client-sdk/index.js')
const util = require('../../utils/util.js')

Page({
  data: {
    rank:[],//排行榜
    userInfo:{},
    myRank: {},
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
      this.setData({
          userInfo:app.globalData.userInfo
      })
      var that = this
      qcloud.request({
          url: '/game/song/songRank',
          data: {
              songId: that.data.songId
          },
          success(res) {
              util.debug('songRank:', res.data)
              let data = res.data
              if (data.errno == 0) {
                  that.setData({
                      rank: data.data.rankList,
                      myRank:data.data.myRank
                  })
              } else {
                  util.showModal('更新金币失败', data.msg)
              }
          }
      })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})