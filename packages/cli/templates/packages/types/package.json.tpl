{
  "name": "{{ORG_NAME}}/types",
  "version": "1.0.0",
  "description": "{{PROJECT_NAME}} 共享类型定义",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
