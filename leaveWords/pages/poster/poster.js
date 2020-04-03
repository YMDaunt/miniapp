var util = require('../../utils/util.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'
var app = getApp()

var store = {
    p_w: 0, //海报宽度
    p_h: 0 // 海报高度
}
Page({
    data: {
        posterUrl: '',
        qrcode: '',
        toUid: -1
    },
    async onLoad(query){
        wx.getNetworkType({
            success(res){
                util.debug('res.networkType :', res.networkType )
                if(res.networkType == 'none'){
                    wx.showModal({
                        title: '温馨提示',
                        content: '请检查网络是否正常'
                    })
                    return
                }
            }
        })
        
        wx.showShareMenu({
            withShareTicket: true
        })
        wx.setNavigationBarTitle({
            title: '最美真心话'
        })
        
        try{
            let checkLogin = await app.checkLogin()
            console.log('checklogin:', checkLogin)
        }catch(e){
            await app.goLogin(null, function(e){
                console.log('登录失败：', e)
            })
        }

        let toUid = typeof(query.uid) == 'undefined' ? app.globalData.userInfo.uid : query.uid
        this.setData({
            toUid
        })

        wx.showLoading({
            title: '图片生成中'
        })

        // 获取小程序码
        try{
            await this.getQrcode(toUid)
        }catch(e){}

        wx.createSelectorQuery().select('.poster_canvas').fields({
            size: true
        }, function(res){
            store.p_w = res.width
            store.p_h = res.height

            // 创建海报canvas
            this.createPoster()
        }.bind(this)).exec(function(e){})
    },
    createPoster(){
        let that = this
        var ctx = wx.createCanvasContext('posterCanvas')
        ctx.drawImage('../../static/poster/share.png', 0, 0, store.p_w, store.p_h)
        
        // 下载网络路径文件到本地，绘制本地文件到画布
        wx.downloadFile({
            url: that.data.qrcode,
            success (res) {
              ctx.drawImage(res.tempFilePath, store.p_w*0.296, store.p_h*0.51, store.p_w*0.4, store.p_h*0.4)
              
              ctx.draw(false, function(){
                  wx.hideLoading()
      
                  wx.canvasToTempFilePath({
                      x: 0,
                      y: 0,
                      width: store.p_w,
                      height: store.p_h,
                      destWidth: 1500,
                      destHeight: 1500,
                      fileType: 'png',
                      canvasId: 'posterCanvas',
                      success(res) {
                          util.debug(`生成海报地址：${res.tempFilePath}`)
                          that.setData({
                              posterUrl: res.tempFilePath
                          })
                      }
                  })
              })

            }
          })
  

    },

    previewPoster() {
        wx.getNetworkType({
            success(res){
                util.debug('res.networkType :', res.networkType )
                if(res.networkType == 'none'){
                    wx.showModal({
                        title: '温馨提示',
                        content: '请检查网络是否正常'
                    })
                    return
                }else{
                    wx.previewImage({
                        urls: [this.data.posterUrl]
                    })
                }
            }
        })
    },

    onLongPress(){
        console.log('onLongPress')
        let that = this
        // 获取是否已授权保存到相册
        wx.getSetting({
            success (res) {
                console.log('res.authSetting:', res.authSetting)
                if(res.authSetting['scope.writePhotosAlbum'] === true){
                    // 已授权
                    that.savePhone()
                }else if(res.authSetting['scope.writePhotosAlbum'] === false){
                    // 曾经拒绝过授权
                    wx.showModal({
                        content: '为了确保你正常使用匿名说，请授权匿名说保存图片到系统相册',
                        confirmText: '去授权',
                        success(res){
                            if (res.confirm) {
                                // 打开设置页引导手动打开授权
                                wx.openSetting({
                                    success (res) {
                                        console.log(res.authSetting)
                                        if(res.authSetting['scope.writePhotosAlbum']){
                                            that.savePhone()
                                        }
                                    }
                                })
                            } else if (res.cancel) {
                                console.log('引导手动授权取消')
                            }
                        },
                        fail(){
                            console.log('引导手动授权出错')
                        }
                    })
                }else{
                    // 首次授权
                    // 尝试主动弹出授权框
                    wx.authorize({
                        scope: 'scope.writePhotosAlbum',
                        success () {
                            console.log('auth success')
                            that.savePhone()
                        },
                        fail(){
                            console.log('auth fail')
                        }
                    })
                }
            }
        })
        
    },
    savePhone(){
        console.log('开始调用保存图片接口')
        wx.saveImageToPhotosAlbum({
            filePath: this.data.posterUrl,
            success(res) { 
                console.log('res:', res)
                wx.showToast({
                    title: '保存成功，快去分享吧'
                })
            },
            fail(res){
                wx.showToast({
                    title: '已取消保存',
                    icon: 'none'
                })
            }
          })
    },

    /**
     * @description 获取二维码
     * @author smy
     * @date 2018-11-09
     */
    getQrcode(toUid){
        let that = this
        return new Promise((resolve, reject) => {
            qcloud.request({
                url: '/game/anonymity/getQrCode',
                data: {
                    toUserId: toUid
                },
                success(res) {
                    let data = res.data
                    console.log("fail:", data)
                    if(data.errno == 0){
                        that.setData({
                            qrcode: data.data.qrCodeUrl
                        })
                        resolve(true)
                    }else{
                        wx.hideLoading()
                        util.showModal('获取二维码失败', data.msg)
                    }
                }
            })

        })
    },

    onShareAppMessage(e){
        return {
            title: '快来偷偷说出你的真心话吧！',
            path: `/pages/index/index?toUserId=${app.globalData.userInfo.uid}`,
            imageUrl: '/static/common/share.png',
            success(res){
                console.log('share:', res)
                if(res.errMsg == 'shareAppMessage:ok'){
                    // 分享成功
                    console.log('分享成功')
                }
            },
            fail(res){
                console.log('fail:', res)
                if(res.errMsg == 'shareAppMessage:cancel'){
                    // 取消分享
                    console.log('取消分享')
                }
            }
        }
    },

    goHome(e){
        wx.navigateTo({
            url: `/pages/index/index?toUserId=${this.data.toUid}`
        })
    }

})