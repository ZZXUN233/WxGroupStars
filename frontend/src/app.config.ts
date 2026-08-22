export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/profile/index',
    'pages/space/index',
    'pages/space-invite/index',
    'pages/work-detail/index',
    'pages/publish/index',
    'pages/search/index',
    'pages/create-space/index',
    'pages/drafts/index',
    'pages/edit-profile/index',
    'pages/webview/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#4f46e5',
    navigationBarTitleText: '群星闪耀',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#8b94a9',
    selectedColor: '#4f46e5',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/profile/index',
        text: '星轨'
      }
    ]
  }
})
