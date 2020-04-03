// pages/guess/guess.js
const app = getApp()
const qcloud = require('../../vendor/wafer2-client-sdk/index.js')
const util = require('../../utils/util.js')
const innerAudioContext = wx.createInnerAudioContext()
var store = {}
Page({

    /**
     * 页面的初始数据
     */
    data: {
        coin: 0, //我的金币
        songId: 0,//当前歌曲id
        mySongId:0,//记录我的猜歌的songId防止混淆
        indexId: 0, //歌曲序号
        songData:[],//歌曲库
        currentSong:[],//当前歌曲信息
        playState: true, //播放状态
        pools: [ //待选字
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
            {
                font: '',
                used: false
            },
        ],
        answer: [],//猜歌答案
        wrongTips:false,//错误答案样式
        answerString: '',
        tipsNum:0,//提示次数
        currentIndex: 0, //当前答案指针
        showResult: false, //展示结果弹窗
        showDeduct: false, //展示扣金币样式
        showDanmu:false,//默认不显示弹幕
        sourceNickName:'',//来自**(nickname)的求助
        sourceUserId: 0,//来自**(uid)的求助
        sourceSongId: 0,//求助的歌曲id
        formId:'',//用户发送模板消息的formId
        showHelpResult:false,
        helpSongId:0,//求助songId
        didSong:false,//这首歌曲做过了
        ad: ''//广告背景图
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function(options) {
        if(options.songId&&options.nickName){
            this.setData({
                sourceSongId:options.songId,
                sourceNickName:options.nickName,
                sourceUserId:options.sourceUserId
            })
        }
        store = {
            isFirstLaunch: true,
            danmuArrCache: [],
            danmuId: 0,
            danmuEndIndex: -1, // 初始化动画已结束的index值
            insertedDanmuIndex: 0, // 已插入的弹幕条数
            loopTimeArr: [], // 循环插入弹幕的定时器
            danmuAreaHeight: 0, //单位px
            msgGroup: [], // 留言数组
            currentMsgIndex: 0, // 当前显示留言数组的批次
            sendMsgFlag: false
        }
        this.getMyInfo()
        this.getAd()
       
    },
    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function() {
    },
    //初始化字幕
    initDanmu:function(){
        this.setData({
            showDanmu:true
        })
        //初始化字幕
        wx.createSelectorQuery().select('.danmu').fields({
            size: true
        }, function (res) {
            store.danmuAreaHeight = res.height
            // 初始化弹幕
            this.getDanmuInfo(this.data.helpSongId)
        }.bind(this)).exec()
    },
    //获取帮助人答案弹幕
    getDanmuInfo(songId) {
        let that = this
        let danmuLen = store.danmuArrCache.length
        qcloud.request({
            url: '/game/song/friendHelperList',
            data: {
                songId: songId
            },
            success(res) {
                util.debug('FriendAnswer:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.insertDanmu(data.data)
                    // that.setData({
                    //     toCommentAvatar: data.data.toUserInfo['avatarUrl']
                    // })

                    // setTimeout(function () {
                    //     if (data.data.list.length == limit) {
                    //         // 弹幕数据可能未拉完，继续拉下一页
                    //         that.getDanmuInfo(uid)
                    //     }
                    // }, 500)
                } else {
                    util.showModal('获取弹幕信息失败', data.msg)
                }
            }
        })
    },
    insertDanmu(newDanmuArr) {
        let that = this
        if(newDanmuArr.length === 0){return false}
        // 初始化弹幕数组
        newDanmuArr.forEach((val) => {
            val['top'] = that.getDanmuRandomTop()
            val['moving'] = true
            val['headPic'] = val.avatarUrl
            val['danmuId'] = store.danmuId
            val['answer'] = that.data.answerString
            store.danmuId++

            store.danmuArrCache.push(val)
        })
        console.log('store.loopTimeArr.len', store.loopTimeArr)
        if (store.loopTimeArr.length == 0) {
            this.loopRunDanmu()
        }
    },
    getDanmuRandomTop() {
        var rand_top = 0;
        (function loop() {
            let len = store.danmuArrCache.length

            // 单条弹幕的高度按照50px进行估算
            rand_top = parseInt(Math.random() * (store.danmuAreaHeight - 50))
            if (len === 0) return rand_top

            // 对每条弹幕的前面4条弹幕取高度进行判断
            for (var i = 1; i < 4; i++) {
                //console.log(`倒数第${i}条检测完毕`)
                if (!store.danmuArrCache[len - i] || !store.danmuArrCache[len - i]['moving']) break

                let abs_num = Math.abs(store.danmuArrCache[len - i]['top'] - rand_top)
                if (abs_num < 50) {
                    loop()
                    break
                }
            }

        })()
        return rand_top
    },
    loopRunDanmu() {
        let that = this
        let total_len = store.danmuArrCache.length
        let index = store.insertedDanmuIndex

        if (total_len == 0) return

        if (index >= total_len) {
            // 循环结束，继续轮询
            //store.insertedDanmuIndex = 0
            // 开启循环检测是否有新弹幕生成，有的话再次setDanmuData
            setTimeout(function () {
                this.loopRunDanmu()
            }.bind(this), 200)
            //console.log('开始下一轮循环')
            return
        }

        this.setDanmuData(index, function () {
            store.insertedDanmuIndex++
            that.loopRunDanmu()
        })
    },
    setDanmuData(index, runDanmuCb) {
        let that = this
        // 设置随机插入的间隔时间，200-1300ms
        let time = Math.random() * 1300 + 200
        let loop_time = setTimeout(() => {

            // 防止页面切换时定时器没清理干净导致上一页面index带到下一页面
            if (store.danmuArrCache[index] == undefined) return

            // 插入数据到视图
            that.setData({
                [`danmuArr[${index}]`]: store.danmuArrCache[index]
            }, function () {
                // 渲染完毕，开始执行动画
                that.runDanmu(index)

                // 插入并运行此条弹幕动画后的回调
                runDanmuCb && runDanmuCb()
            })
        }, time)
        store.loopTimeArr.push(loop_time)
    },
    runDanmu(index) {

        let animation = wx.createAnimation({
            duration: 7000
        })

        animation.right('750rpx').translateX(0).step()
        this.setData({
            [`danmuAniData[${index}]`]: animation.export()
        })
    },
    /**
     * @description 弹幕动画结束的回调
     * @author smy
     * @date 2018-11-19
     * @param {*} e 弹幕参数
     */
    aniend(e) {
        let i = e.currentTarget.dataset.index

        // 防止弹幕动画多次执行回调，导致函数体多次执行
        if (store.danmuEndIndex != i) {
            store.danmuEndIndex = i
            store.danmuArrCache[i]['moving'] = false

            // 恢复动画到最初状态
            let animation = wx.createAnimation({
                duration: 0
            })
            animation.right('0').translateX('100%').step()
            this.setData({
                [`danmuAniData[${i}]`]: animation.export()
            })

            // 继续循环运行此条弹幕
            // this.setDanmuData(i)
        } else {
            store.danmuEndIndex = -1
        }
        /* else if(store.danmuEndIndex == len-1){
            // 每次和弹幕缓存的数量进行对比判断，当是最后一条数据的时候
            store.danmuEndIndex = -1
        } */
    },
    //获取用户信息
    getMyInfo: function () {
        var that = this
        qcloud.request({
            url: '/game/user/getMyUserInfo',
            success(res) {
                util.debug('MyUserInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        coin: data.data.guessSong.coin,
                        songId: data.data.guessSong.songId,
                        helpSongId: data.data.guessSong.songId,
                        indexId: data.data.guessSong.indexId,
                        mySongId: data.data.guessSong.songId
                    })
                    if(that.data.sourceUserId){
                        //请求帮助好友答题的歌曲列表
                        that.getHelpSong()
                    }else{
                        //请求自己答题的歌曲列表
                        that.getSong()
                        wx.getStorage({
                            key: 'forHelp',
                            success(res) {
                                if (res.data) {
                                    wx.setStorage({
                                        key: 'forHelp',
                                        data: false
                                    })
                                    that.initDanmu()
                                }
                            }
                        })
                    }
                } else {
                    util.showModal('获取用户信息失败', data.msg)
                }
            }
        })
    },
    //获取求助歌曲信息
    getHelpSong:function(){
        var that = this
        qcloud.request({
            url: '/game/song/getSongInfo',
            data: {
                songId: that.data.sourceSongId,
                sourceUserId:that.data.sourceUserId
            },
            success(res) {
                util.debug('songInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        currentSong: data.data.songInfo
                    })
                    that.initSong()
                } else {
                    util.showModal('获取求助歌曲信息失败', data.msg)
                }
            }
        })
    },
    //获取歌曲
    getSong:function(){
        var that = this
        qcloud.request({
            url: '/game/song/songsPage',
            data:{
                songId:this.data.songId
            },
            success(res) {
                util.debug('songInfo:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        songData:data.data,
                        answerString: (data.data)[0].answer,
                        currentSong:data.data.shift()
                    })
                    that.initSong()
                } else {
                    util.showModal('获取歌曲信息失败', data.msg)
                }
            }
        })
    },
    //歌曲初始化
    initSong: function () {
        this.clear()
        this.setData({
            tipsNum: 0,//歌曲提示次数归0
            songId: this.data.currentSong.id
        })
        //根据后台返回值拼凑pools
        this.data.pools.map((item, index) => {
            this.setData({
                [`pools[${index}].font`]: this.data.currentSong.words.split(',')[index]
            })
        })
        //根据后台返回值拼凑answer
        let len = this.data.currentSong.answer.length
        let answerTemp = []
        var i = 1
        while (i <= len) {
            answerTemp.push({ font: '', pIndex: '' })
            i++
        }
        this.setData({
            answer: answerTemp
        })
        this.palyAudio(this.data.currentSong.file)
    },
    //获取广告背景图
    getAd: function () {
        var that = this
        qcloud.request({
            url: '/game/song/config',
            success(res) {
                util.debug('AdConfig:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        ad: data.data.bannerList.main
                    })
                } else {
                    util.showModal('获取广告信息失败', data.msg)
                }
            }
        })
    },
    palyAudio: function (file) {
        innerAudioContext.stop()
        innerAudioContext.autoplay = true //自动播放
        innerAudioContext.loop = true //循环播放
        innerAudioContext.src = file
        // innerAudioContext.onPlay(() => {
        //     console.log('开始播放')
        // })
        innerAudioContext.onError((res) => {
            console.log(res.errMsg)
            console.log(res.errCode)
        })
    },
    playOrPause: function() {
        this.setData({
            playState: !this.data.playState
        })
        if (!this.data.playState) {
            innerAudioContext.pause(); //暂停
        } else {
            innerAudioContext.play(); //播放
        }
    },
    //答案回退
    back:function(e){
        var index = e.currentTarget.dataset.index
        var pindex = e.currentTarget.dataset.pindex 
        var currentPoolsUsed = 'pools[' + pindex + '].used'; //答案池中选中的那个
        this.setData({
            [currentPoolsUsed]: false
        })
        var currentAnswer = 'answer[' + index + ']'
        var font = '',pIndex = ''
        this.setData({
            currentIndex:index,
            [currentAnswer]: { font, pIndex}
        })
    },
    //清除答案
    clear: function() {
        //答案栏清空
        this.data.answer.map((item, index) => {
            var currentAnswer = 'answer[' + index + ']';
            this.setData({
                [currentAnswer]: {font:'',pIndex:''}
            })
        })
        //答案指针归零
        this.setData({
            currentIndex: 0
        })
        //答案池使用情况恢复
        this.data.pools.map((item, index) => {
            var currentPoolsUsed = 'pools[' + index + '].used';
            this.setData({
                [currentPoolsUsed]: false
            })
        })
    },
    //选择答案
    select: function(e) {
        //答案填完后点击无效
        if (this.data.currentIndex >= this.data.answer.length) {
            return false
        }

        if (this.data.pools[e.currentTarget.dataset.index].used) {
            console.log('已经使用过了')
            return false
        }

        var currentPoolsUsed = 'pools[' + e.currentTarget.dataset.index + '].used'; //答案池中选中的那个
        this.setData({
            [currentPoolsUsed]: true
        })
        this.data.answer.map((item, index) => {
            if (index === this.data.currentIndex) {
                var currentAnswer = 'answer[' + index + ']';
                var font = e.currentTarget.dataset.item
                var pIndex = e.currentTarget.dataset.index
                this.setData({
                    [currentAnswer]: { font, pIndex}
                })
            }
            
        })
        for(let i =0;i<=this.data.answer.length;i++){
            //使得currentIndex等于answer.length
            if (i === this.data.answer.length) {
                this.setData({
                    currentIndex: i
                })
                break;
            }
            if (this.data.answer[i].pIndex === '') {
                this.setData({
                    currentIndex: i
                })
                break;
            }
            
        }
        this.isCheckAnswer()
    },
    //answer填满时判断答案是否正确
    isCheckAnswer:function(){
        var result = this.data.answer.every((item) => {
            return item.font ? true : false
        })
        if (result) {
            if (this.data.sourceUserId) {
                this.checkFriendAnswer()
            }else{
                this.checkAnswer()
            }
        }
    },
    //判断答案是否正确
    checkAnswer:function(){
        let answerString = ''
        let that = this
        that.data.answer.map((item,index)=>{
            answerString += item.font
        })
        
        qcloud.request({
            url: '/game/song/answer',
            data:{
                songId:that.data.songId,
                answer:answerString
            },  
            success(res) {
                util.debug('checkAnswerResult:', res.data)
                let data = res.data
                if (data.errno == 0) {
                   that.setData({
                       showResult:true,
                       coin:data.data.coin,
                       answerString:answerString
                       //indexId:data.data.indexId,
                       //songId:data.data.songId
                   })
                    that.palyAudio(that.data.currentSong.file2)
                    //清除之前的字幕
                    // that.setData({
                    //     answerString:'',
                    //     showDanmu:false
                    // })
                } else {
                    that.setData({
                        wrongTips:true
                    })
                    var timer;                    
                    timer = setTimeout(() => {
                        that.setData({
                            wrongTips: false
                        })
                        that.clear()
                        clearTimeout(timer)
                    }, 500)
                }
            }
        })
    },
    formSubmit(e) {
        this.setData({
            formId: e.detail.formId
        })
    },
    //判断朋友的答案是否正确
    checkFriendAnswer:function(){
        let answerString = ''
        let that = this
        that.data.answer.map((item, index) => {
            answerString += item.font
        })

        qcloud.request({
            url: '/game/song/friendHelperAnswer',
            data: {
                songId: that.data.songId,
                answer: answerString,
                sourceUserId:that.data.sourceUserId,
                formId:that.data.formId
            },
            success(res) {
                util.debug('checkFriendAnswerResult:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        showHelpResult: true,
                        // coin: data.data.coin,
                        //indexId:data.data.indexId,
                        //songId:data.data.songId
                    })
                    that.palyAudio(that.data.currentSong.file2)
                }else if(data.errno === 1010){
                    that.setData({
                        showHelpResult: true,
                        didSong:true,
                    })
                    that.palyAudio(that.data.currentSong.file2)
                }else {
                    that.setData({
                        wrongTips: true
                    })
                    var timer;
                    timer = setTimeout(() => {
                        that.setData({
                            wrongTips: false
                        })
                        that.clear()
                        clearTimeout(timer)
                    }, 500)
                }
            }
        })
    },
    //点击提示
    getTips: function() {
        let timer;
        
        //console.log(result)

        //请求后台接口更新金币
        var that = this
        qcloud.request({
            url: '/game/song/tips',
            data: {
                songId: that.data.songId
            },
            success(res) {
                util.debug('checkAnswerResult:', res.data)
                let data = res.data
                if (data.errno == 0) {
                    that.setData({
                        coin: data.data.coin,
                        //indexId:data.data.indexId,
                        //songId:data.data.songId
                    })
                    that.setData({
                        showDeduct: true,
                        tipsNum: ++that.data.tipsNum
                    })
                    var aIndex = that.data.answerString.length - that.data.tipsNum;
                    var result = that.getAnswer(aIndex)
                    that.data.pools.map((item, index) => {
                        var currentPoolsUsed = 'pools[' + index + '].used'; //答案池中选中的那个
                        if (index === result.pIndex) {
                            that.setData({
                                [currentPoolsUsed]: true
                            })
                        } else {
                            if (!that.data.pools[index].used) {
                                that.setData({
                                    [currentPoolsUsed]: false
                                })
                            }
                        }
                    })
                    that.setData({
                        [`answer[${aIndex}]`]: result
                    })

                    that.isCheckAnswer()

                    //扣除金币样式
                    if (timer) { return false }
                    timer = setTimeout(() => {
                        that.setData({
                            showDeduct: false
                        })
                        clearTimeout(timer)
                    }, 1500)
                } else {
                    util.showModal('更新金币失败', data.msg)
                }
            }
        })

       
    },
    //拼凑提示答案
    getAnswer:function(aIndex){
        var font = this.data.answerString.charAt(aIndex)
        var pIndex = (this.data.currentSong.words.indexOf(font))/2
        return {
            font:font,
            pIndex:pIndex
        }
    },
    //下一首歌曲
    getNextSong:function(){
        if(this.data.songData.length === 0){
            this.getSong()
        }else{
            this.setData({
                currentSong:this.data.songData.shift(),
                indexId:this.data.indexId+1
            })
            this.initSong()
        }
        this.setData({
            showResult: false
        })
    },
    toMiniapp: function() {
        wx.navigateToMiniProgram({
            appId: 'wx3490aef65724e32d', // 要跳转的小程序的appid
            path: '', // 跳转的目标页面
            extarData: {},
            success(res) {
                console.log('跳转小程序成功')
                app.aldstat.sendEvent('成功跳转广告', {
                    name: '星光小程序'
                })
            },
            fail(err) {
                console.log('跳转失败:', err)
            }
        })
    },



    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function(options) {
        console.log(options)
        // 判断是否是首次启动
        if (store.isFirstLaunch) {
            store.isFirstLaunch = false
            return
        } else {
            // 当不是首次启动，从后台切过来时
            // 初始化弹幕
            this.getDanmuInfo(this.data.helpSongId)
        }
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function() {
        //进入后台音乐停止
        this.setData({
            playState: false
        })
        innerAudioContext.stop()
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function() {
        //退出当前页音乐停止
        innerAudioContext.stop()
    },
    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function(e) {
        if(e.target && e.target.dataset.type == 'help'){
            wx.setStorage({
                key: 'forHelp',
                data: true
            })
            let that=this
            return {
                title: '这首歌我猜不到，快来帮我下',
                path: '/pages/guess/guess?songId='+ this.data.songId +'&sourceUserId=' + app.globalData.userInfo.uid +'&nickName='+app.globalData.userInfo.nickName,
                imageUrl: 'https://static.guojiang.tv/src/miniapp/guessSongs/index/share.jpg',
                // success:function(){
                //     that.initDanmu()
                //     // setInterval(()=>{
                //     //     that.getFriendAnswer()
                //     // },2000)
                // }
            }
        }else{
            return {
                title: '总有一首歌是你喜欢的',
                path: '/pages/index/index',
                imageUrl: 'https://static.guojiang.tv/src/miniapp/guessSongs/index/share.jpg'
            }
        }
    }
})