import { View, Text } from '@tarojs/components'
import './index.scss'

export default function Privacy() {
  return (
    <View className='privacy'>
      <View className='privacy-header'>
        <Text className='privacy-title'>隐私说明</Text>
        <Text className='privacy-update'>更新日期：2026 年 8 月 24 日</Text>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>一、应用定位</Text>
        <Text className='section-body'>
          「群星闪耀」是一款由个人开发者独立开发的非商业应用，仅供开发者本人及受邀用户个人使用。本应用不以盈利为目的，不对外公开运营。
        </Text>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>二、信息收集</Text>
        <Text className='section-body'>
          本应用通过微信开放平台获取以下信息，用于基础功能的实现：
        </Text>
        <View className='privacy-list'>
          <Text className='list-item'>• 微信昵称与头像：用于在群空间中展示用户身份，由用户主动授权提供。</Text>
          <Text className='list-item'>• 微信 OpenID：用于识别用户身份，确保数据隔离，不会用于其他用途。</Text>
          <Text className='list-item'>• 群聊信息（openGId）：仅用于验证用户是否属于某个群聊，不存储群聊具体内容。</Text>
        </View>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>三、数据存储与安全</Text>
        <Text className='section-body'>
          用户发布的内容（文字、图片、音视频等）存储在开发者自建服务器上，不传输至第三方。服务器仅用于支撑本应用的基本功能，不会将数据用于商业分析或用户画像。
        </Text>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>四、数据共享</Text>
        <Text className='section-body'>
          本应用不会将任何用户数据出售、出租、交换或以其他方式提供给任何第三方。用户数据仅在群空间成员之间可见，不对群外人员开放。
        </Text>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>五、数据删除</Text>
        <Text className='section-body'>
          用户可随时删除自己发布的内容。如需彻底删除账户及所有关联数据，请联系开发者。
        </Text>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>六、未成年人使用</Text>
        <Text className='section-body'>
          本应用不面向 14 周岁以下未成年人提供服务。如监护人发现未成年人未经同意使用本应用，请联系开发者处理。
        </Text>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>七、变更通知</Text>
        <Text className='section-body'>
          本隐私说明可能不定期更新。更新后的说明将在应用内公示，继续使用本应用即视为同意更新后的说明。
        </Text>
      </View>

      <View className='privacy-section'>
        <Text className='section-title'>八、联系方式</Text>
        <Text className='section-body'>
          如对本隐私说明有任何疑问，请通过以下方式联系开发者：
        </Text>
        <Text className='contact'>邮箱：zzxun233@outlook.com</Text>
        <Text className='contact'>微信：zzxun233</Text>
      </View>

      <View className='privacy-footer'>
        <Text className='footer-text'>「群星闪耀」— 个人项目，仅供个人使用</Text>
      </View>
    </View>
  )
}
