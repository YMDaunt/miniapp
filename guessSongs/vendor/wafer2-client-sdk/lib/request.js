var constants = require('./constants');
var utils = require('./utils');
var Session = require('./session');
var loginLib = require('./login');
var config = require('../../../config');

var noop = function noop() {};

var buildAuthHeader = function buildAuthHeader(session) {
    var header = {};

    if (session) {
        header[constants.WX_HEADER_SKEY] = session;
    }

    return header;
};

/***
 * @class
 * 表示请求过程中发生的异常
 */
var RequestError = (function () {
    function RequestError(type, message) {
        Error.call(this, message);
        this.type = type;
        this.message = message;
    }

    RequestError.prototype = new Error();
    RequestError.prototype.constructor = RequestError;

    return RequestError;
})();

function request(options) {

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

    if (typeof options !== 'object') {
        var message = '请求传参应为 object 类型，但实际传了 ' + (typeof options) + ' 类型';
        throw new RequestError(constants.ERR_INVALID_PARAMS, message);
    }

    var requireLogin = options.login;
    var success = options.success || noop;
    var fail = options.fail || noop;
    var complete = options.complete || noop;
    var originHeader = options.header || {};

    // 自动增加请求url的域名
    var requestUrl = options.url;
    if(requestUrl && requestUrl.indexOf(config.service.host) == -1){
        requestUrl = /^\//.test(requestUrl) ? requestUrl : '/'+requestUrl
        options.url = config.service.host + requestUrl
    }

    // 成功回调
    var callSuccess = function () {
        success.apply(null, arguments);
        complete.apply(null, arguments);
    };

    // 失败回调
    var callFail = function (error) {
        fail.call(null, error);
        complete.call(null, error);
    };

    // 是否已经进行过重试
    var hasRetried = false;

    if (requireLogin) {
        doRequestWithLogin();
    } else {
        doRequest();
    }

    // 登录后再请求
    function doRequestWithLogin() {
        /* loginLib.loginWithCode({ success: doRequest, fail: callFail }); */
        loginLib.login({ success: doRequest, fail: callFail });
    }

    // 实际进行请求的方法
    function doRequest() {
        var authHeader = {}

        var session = Session.get();
    
        if (session) {
            authHeader = buildAuthHeader(session.skey);
        }

        // 增加UA信息
        var uaHeader = {}
        uaHeader[constants.GJ_HEADER_VERSION] = config.headerInfo.version;
        uaHeader[constants.GJ_HEADER_PRODUCT] = config.headerInfo.product;
        uaHeader[constants.GJ_HEADER_OS] = config.headerInfo.platform;

        // 更新post请求的header
        var postHeader = {}
        if(options.method == 'POST'){
            postHeader['content-type'] = 'application/x-www-form-urlencoded'
        }
        
        wx.request(utils.extend({}, options, {
            header: utils.extend({}, originHeader, authHeader, uaHeader, postHeader),
            
            success: function (response) {
                var data = response.data;
                var error, message;
                
                // 用户被封禁情况
                if(data.errno == -101){
                    wx.showModal({
                        title: '提示',
                        content: '您的账户已被封禁'
                    })
                    callFail(data)
                    
                    // 清楚登录状态并更新全局状态
                    Session.clear()
                    var app = getApp()
                    if(app){
                        app.globalData.isLogin = false
                        app.globalData.userInfo = null
                    }
                    return
                }
                
                if ((data && data.errno === -100) || response.statusCode === 401) {
                    // 未登录，登录态失效
                    Session.clear();
                    // 如果是登录态无效，并且还没重试过，会尝试登录后刷新凭据重新请求
                    console.log('hasRetried:', hasRetried)
                    if (!hasRetried) {
                        hasRetried = true;
                        doRequestWithLogin();
                        return;
                    }

                    message = '登录态已过期';
                    error = new RequestError(data.error, message);

                    callFail(error);
                    return;
                } else {
                    callSuccess.apply(null, arguments);
                }
            },

            fail: callFail,
            complete: noop,
        }));
    };

};

module.exports = {
    RequestError: RequestError,
    request: request,
};