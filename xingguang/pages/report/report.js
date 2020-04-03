var config = require('../../config.js')
var util = require('../../utils/util.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')

var flag = false

Page({
    data: {
        reportContentList: [
            {
                id: 1,
                text: '色情交易'
            },
            {
                id: 2,
                text: '垃圾广告'
            },
            {
                id: 3,
                text: '人身攻击'
            },
            {
                id: 4,
                text: '敏感信息'
            },
            {
                id: 5,
                text: '虚假中奖信息'
            },
            {
                id: 6,
                text: '其他'
            }
        ],
        selectedIndex: -1,
        hideImgMask: false,
        previewImgUrl: '',
        reportId: -1,
        reason: -1
    },
    onLoad(res){
        flag = false

        this.setData({
            reportId: res.id
        })
    },
    selectContent(e){
        this.setData({
            selectedIndex: e.target.dataset.index,
            reason: e.target.dataset.id
        })
    },
    selectImg(){
        let that = this
        wx.chooseImage({
            count: 1,
            success(res){
                // tempFilePath可以作为img标签的src属性显示图片
                var tempFilePaths = res.tempFilePaths
                util.showBusy('加载中...')
                that.setData({
                    previewImgUrl: tempFilePaths[0],
                    hideImgMask: true
                }, function(){
                    wx.hideToast()
                })
            }
        })
    },
    clearImg(){
        this.setData({
            previewImgUrl: '',
            hideImgMask: false
        })
    },
    submit(){
        if(flag) return
        flag = true

        if(this.data.reason === -1){
            util.showToast('请选择要举报的原因', 1500)
            flag = false
            return
        }

        if(this.data.previewImgUrl == ''){
            util.showToast('请上传截图哦', 1500)
            flag = false
            return
        }

        let that = this
        wx.showToast({
            title: '上传中...',
            icon: 'loading',
            duration: 15000,
            mask: true
        })

        var session = qcloud.Session.get()
        var uaHeader = {}
    
        if (session) {
            // 增加UA信息
            uaHeader[qcloud.WX_HEADER_SKEY] = session.skey;
            uaHeader[qcloud.GJ_HEADER_CHANNEL] = config.headerInfo.channel;
            uaHeader[qcloud.GJ_HEADER_PACKAGEID] = config.headerInfo.packageId;
            uaHeader[qcloud.GJ_HEADER_VERSION] = config.headerInfo.version;
        }


        wx.uploadFile({
            url: `${config.service.host}/index/userReport`, //仅为示例，非真实的接口地址
            filePath: that.data.previewImgUrl,
            name: 'pic',
            formData: {
              id: that.data.reportId,
              type: 1,
              reason: that.data.reason
            },
            header: uaHeader,
            success (res){
                flag = false
                let data = res.data
                data = typeof(data) == 'string' ? JSON.parse(data) : data
                util.debug('report data:', data)
            
                if(data.errno === 0){
                    util.showSuccess('举报成功')
                    that.setData({
                        selectedIndex: -1,
                        hideImgMask: false,
                        previewImgUrl: '',
                        reportId: -1,
                        reason: -1
                    })
                }else{
                    util.showToast(data.msg, 5000)
                }
            },
            fail(){
                util.showToast('微信上传接口调用失败，请再次尝试')
            }
        })
    }
})