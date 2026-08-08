/**
 * Taro 4.2.1 类型缺口补全。
 * showModal 底层微信 API 支持 editable/placeholderText（带输入框的模态框），
 * 且成功回调含 content（输入内容），但官方类型未收录 —— 在此补全。
 * 参考：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showModal.html
 */
declare namespace Taro {
  namespace showModal {
    interface Option {
      /** 是否显示输入框 */
      editable?: boolean
      /** 输入框的提示文本 */
      placeholderText?: string
    }

    interface SuccessCallbackResult {
      /** editable 为 true 时，用户输入的内容 */
      content?: string
    }
  }
}
