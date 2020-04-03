var util = require('../../utils/util.js')
var qcloud = require('../../vendor/wafer2-client-sdk/index.js')
import regeneratorRuntime from '../../vendor/regenerator-runtime/runtime'

Component({
    properties: {

    },
    data: {
    },
    ready: function(){
        
    },
    methods: {
        async copy () {
            try{
                let getUrl = await this.getDownloadUrl()
                let url = getUrl.url
                wx.setClipboardData({
                    data: url,
                    fail(){
                        util.showModal('复制失败', `请再次尝试`)
                    }
                })

            }catch(e){
                util.showToast(e)
            }
        },

        getDownloadUrl(){
            return new Promise((resolve, reject) => {
                qcloud.request({
                    url: '/index/downloadUrl',
                    success(res){
                        let data = res.data
                        util.debug(data)
                        if(data.errno == 0){
                            resolve(data.data)
                        }else{
                            reject(data.msg)
                        }
                    }
                })

            })
        }
    }
})