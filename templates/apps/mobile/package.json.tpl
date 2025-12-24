{
  "name": "{{ORG_NAME}}/mobile",
  "version": "1.0.0",
  "description": "{{PROJECT_NAME}} 移动端小程序",
  "private": true,
  "templateInfo": {
    "name": "default",
    "typescript": true,
    "css": "sass"
  },
  "scripts": {
    "build:weapp": "taro build --type weapp",
    "dev": "npm run dev:weapp",
    "dev:weapp": "npm run build:weapp -- --watch",
    "dev:h5": "taro build --type h5 --watch",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@babel/runtime": "^7.23.6",
    "@svton/api-client": "^1.0.0",
    "@svton/hooks": "^1.0.0",
    "@svton/taro-ui": "^1.0.0",
    "@{{ORG_NAME}}/types": "workspace:*",
    "@tarojs/components": "3.6.23",
    "@tarojs/helper": "3.6.23",
    "@tarojs/plugin-framework-react": "3.6.23",
    "@tarojs/plugin-platform-weapp": "3.6.23",
    "@tarojs/react": "3.6.23",
    "@tarojs/runtime": "3.6.23",
    "@tarojs/taro": "3.6.23",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@babel/core": "^7.23.6",
    "@tarojs/cli": "3.6.23",
    "@tarojs/webpack5-runner": "3.6.23",
    "@types/react": "^18.2.45",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "babel-preset-taro": "3.6.23",
    "eslint": "^8.56.0",
    "eslint-config-taro": "3.6.23",
    "typescript": "^5.3.3"
  }
}
