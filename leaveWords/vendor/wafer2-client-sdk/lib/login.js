/**
 * README!!!
 * 为了兼容微信修改的登录逻辑
 * 这里对登录的 SDK 进行重构
 * 微信公告：https://developers.weixin.qq.com/blogdetail?action=get_post_info&lang=zh_CN&token=&docid=0000a26e1aca6012e896a517556c01
 */
var constants = require('./constants');
var Session = require('./session');
var config = require('../../../config.js')

/**
 * 微信登录，获取 code 和 encryptData
 */
function getWxLoginResult (cb) {
    wx.login({
        success (loginResult) {
            console.log('loginResult:', loginResult)
            wx.getSetting({
                success(res){
                    console.log('getSetting:', res)
                    if(res.authSetting['scope.userInfo'] === undefined){
                        // 需要弹框授权
                        cb('需要弹框授权', null)     
                        return
                    }else{
                        getUserInfoLogin(loginResult, cb)
                    }
                }
            })
        },
        fail (loginError) {
            cb(new Error('微信登录失败，请检查网络状态'), null)
        }
    })
}

function getUserInfoLogin(loginResult, cb){
    wx.getUserInfo({
        success (userResult) {
            console.log('userResult:', userResult)

            cb(null, {
                code: loginResult.code,
                encryptedData: userResult.encryptedData,
                iv: userResult.iv,
                rawData: userResult.rawData,
                signature: userResult.signature,
                userInfo: userResult.userInfo
            })
        },
        fail (userError) {
            cb(new Error('获取微信用户信息失败，请检查网络状态'), null)
        }
    });
}

const noop = function noop() {}
const defaultOptions = {
    method: 'POST',
    success: noop,
    fail: noop,
    loginUrl: null,
}

/**
 * @method
 * 进行服务器登录，以获得登录会话
 * 受限于微信的限制，本函数需要在 <button open-type="getUserInfo" bindgetuserinfo="bindGetUserInfo"></button> 的回调函数中调用
 * 需要先使用 <button> 弹窗，让用户接受授权，然后再安全调用 wx.getUserInfo 获取用户信息
 *
 * @param {Object}   opts           登录配置
 * @param {string}   opts.loginUrl  登录使用的 URL，服务器应该在这个 URL 上处理登录请求，建议配合服务端 SDK 使用
 * @param {string}   [opts.method]  可选。请求使用的 HTTP 方法，默认为 GET
 * @param {Function} [opts.success] 可选。登录成功后的回调函数，参数 userInfo 微信用户信息
 * @param {Function} [opts.fail]    可选。登录失败后的回调函数，参数 error 错误信息
 */
function login (opts) {
    opts = Object.assign({}, defaultOptions, opts)

    if (!opts.loginUrl) {
        return opts.fail(new Error('登录错误：缺少登录地址，请通过 setLoginUrl() 方法设置登录地址'))
    }

    getWxLoginResult((err, loginResult) => {
        if (err) {
            return opts.fail(err)
        }

        // 构造请求头，包含 code、encryptedData 和 iv
        const header = {
            [constants.WX_HEADER_CODE]: loginResult.code,
            [constants.WX_HEADER_ENCRYPTED_DATA]: loginResult.encryptedData,
            [constants.WX_HEADER_IV]: loginResult.iv,
            [constants.GJ_HEADER_VERSION]: config.headerInfo.version,
            [constants.GJ_HEADER_PRODUCT]: config.headerInfo.product,
            [constants.GJ_HEADER_OS]: config.headerInfo.platform,
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        wx.getNetworkType({
            success(res){
                if(res.networkType == 'none'){
                    wx.hideLoading()
                    wx.hideToast()
                    wx.showModal({
                        title: '温馨提示',
                        content: '请检查网络是否正常'
                    })
                    return
                }
            }
        })
        
        // 请求服务器登录地址，获得会话信息
        wx.request({
            url: opts.loginUrl,
            header: header,
            method: opts.method,
            data: {
                rawData: loginResult.rawData,
                signature: loginResult.signature
            },
            success (result) {
                console.log('loginWithMyServer:', result)
                const data = result.data;
                var app = getApp()
                // 用户被封禁情况
                if(data.errno == -101){
                    wx.showModal({
                        title: '提示',
                        content: '您的账户已被封禁'
                    })
                    opts.fail(new Error(`您的账户已被封禁`))
                    
                    // 清楚登录状态并更新全局状态
                    Session.clear()
                    
                    if(app){
                        app.globalData.isLogin = false
                        app.globalData.userInfo = {}
                    }
                    return
                }

                if (!data || data.errno !== 0 || !data.data || !data.data.skey) {
                    return opts.fail(new Error(`响应错误，${JSON.stringify(data)}`))
                }
                
                // 成功地响应会话信息
                const res = data.data
                res.userInfo = loginResult.userInfo
                res.userInfo.uid = res.userId
                Session.set(res)
                opts.success(res)
            },
            fail (err) {
                console.error('登录失败，可能是网络错误或者服务器发生异常')
                opts.fail(err)
            }
        });
    })
}

/**
 * @method
 * 只通过 wx.login 的 code 进行登录
 * 已经登录过的用户，只需要用 code 换取 openid，从数据库中查询出来即可
 * 无需每次都使用 wx.getUserInfo 去获取用户信息
 * 后端 Wafer SDK 需配合 1.4.x 及以上版本
 * 
 * @param {Object}   opts           登录配置
 * @param {string}   opts.loginUrl  登录使用的 URL，服务器应该在这个 URL 上处理登录请求，建议配合服务端 SDK 使用
 * @param {string}   [opts.method]  可选。请求使用的 HTTP 方法，默认为 GET
 * @param {Function} [opts.success] 可选。登录成功后的回调函数，参数 userInfo 微信用户信息
 * @param {Function} [opts.fail]    可选。登录失败后的回调函数，参数 error 错误信息
 */
function loginWithCode (opts) {
    opts = Object.assign({}, defaultOptions, opts)

    if (!opts.loginUrl) {
        return opts.fail(new Error('登录错误：缺少登录地址，请通过 setLoginUrl() 方法设置登录地址'))
    }

    wx.login({
        success (loginResult) {
            // 构造请求头，包含 code、encryptedData 和 iv
            const header = {
                [constants.WX_HEADER_CODE]: loginResult.code
            }
    
            // 请求服务器登录地址，获得会话信息
            wx.request({
                url: opts.loginUrl,
                header: header,
                method: opts.method,
                success (result) {
                    const data = result.data;

                    if (!data || data.errno !== 0 || !data.data || !data.data.skey) {
                        return opts.fail(new Error(`用户未登录过，请先使用 login() 登录`))
                    }
    
                    const res = data.data
    
                    if (!res || !res.userInfo) {
                        return opts.fail(new Error(`登录失败(${data.error})：${data.message}`))
                    }
    
                    // 成功地响应会话信息
                    Session.set(res)
                    opts.success(res.userInfo)
                },
                fail (err) {
                    console.error('登录失败，可能是网络错误或者服务器发生异常')
                    opts.fail(err)
                }
            });
        }
    })
}

function setLoginUrl (loginUrl) {
    defaultOptions.loginUrl = loginUrl;
}

module.exports = { login, setLoginUrl, loginWithCode }
