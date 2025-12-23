# @svton/taro-ui

Taro UI 组件库，为微信小程序提供高质量的 React 组件。

## 安装

```bash
npm install @svton/taro-ui
```

## 组件列表

### NavBar 导航栏

```tsx
import { NavBar } from '@svton/taro-ui'

function Page() {
  return (
    <NavBar
      title="页面标题"
      leftIcon="arrow-left"
      onLeftClick={() => Taro.navigateBack()}
    />
  )
}
```

### StatusBar 状态栏

```tsx
import { StatusBar } from '@svton/taro-ui'

function Page() {
  return (
    <View>
      <StatusBar />
      <NavBar title="页面标题" />
      {/* 页面内容 */}
    </View>
  )
}
```

### TabBar 底部导航

```tsx
import { TabBar } from '@svton/taro-ui'

function App() {
  const [current, setCurrent] = useState(0)

  return (
    <TabBar
      current={current}
      onChange={setCurrent}
      items={[
        { title: '首页', icon: 'home' },
        { title: '我的', icon: 'user' },
      ]}
    />
  )
}
```

### Button 按钮

```tsx
import { Button } from '@svton/taro-ui'

function Page() {
  return (
    <View>
      <Button type="primary">主要按钮</Button>
      <Button type="default">默认按钮</Button>
      <Button type="primary" loading>加载中</Button>
      <Button type="primary" disabled>禁用</Button>
    </View>
  )
}
```

### Tabs 标签页

```tsx
import { Tabs } from '@svton/taro-ui'

function Page() {
  const [current, setCurrent] = useState(0)

  return (
    <Tabs
      current={current}
      onChange={setCurrent}
      tabs={[
        { title: '全部' },
        { title: '待审核' },
        { title: '已通过' },
      ]}
    />
  )
}
```

### ImageUploader 图片上传

```tsx
import { ImageUploader } from '@svton/taro-ui'

function Page() {
  const [files, setFiles] = useState([])

  return (
    <ImageUploader
      files={files}
      onChange={setFiles}
      maxCount={9}
      onUpload={async (file) => {
        // 上传逻辑
        return uploadedUrl
      }}
    />
  )
}
```

### ImageGrid 图片网格

```tsx
import { ImageGrid } from '@svton/taro-ui'

function Page() {
  const images = [
    'https://example.com/1.jpg',
    'https://example.com/2.jpg',
  ]

  return <ImageGrid images={images} />
}
```

### List 列表

```tsx
import { List, ListItem } from '@svton/taro-ui'

function Page() {
  return (
    <List>
      <ListItem title="设置" arrow onClick={() => {}} />
      <ListItem title="关于" arrow />
    </List>
  )
}
```

## 样式导入

在 `app.scss` 中导入样式：

```scss
@import '@svton/taro-ui/dist/styles/index.scss';
```

## 最佳实践

1. **页面结构**：每个页面都应包含 `StatusBar` 和 `NavBar`
2. **按钮状态**：合理使用 `loading` 和 `disabled` 状态
3. **图片上传**：配合后端 API 实现完整的上传流程
