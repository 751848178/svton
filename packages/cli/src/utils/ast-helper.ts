import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import fs from 'fs-extra';

/**
 * 向 TypeScript 文件添加 import 语句
 */
export function addImportToFile(
  code: string,
  importDeclarations: Array<{ from: string; imports: string[] }>,
): string {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy'],
  });

  // 找到最后一个 import 语句的位置
  let lastImportIndex = -1;
  
  traverse(ast, {
    ImportDeclaration(path) {
      const start = path.node.start;
      if (start !== null && start !== undefined && start > lastImportIndex) {
        lastImportIndex = start;
      }
    },
  });

  // 生成新的 import 语句
  const newImports = importDeclarations.map(({ from, imports }) => {
    const specifiers = imports.map((imp) =>
      t.importSpecifier(t.identifier(imp), t.identifier(imp)),
    );
    return t.importDeclaration(specifiers, t.stringLiteral(from));
  });

  // 插入新的 import 语句
  if (lastImportIndex >= 0) {
    // 在最后一个 import 之后插入
    const program = ast.program;
    const lastImportNode = program.body.find(
      (node) => node.type === 'ImportDeclaration' && node.start !== null && node.start === lastImportIndex,
    );
    
    if (lastImportNode) {
      const index = program.body.indexOf(lastImportNode);
      program.body.splice(index + 1, 0, ...newImports);
    }
  } else {
    // 如果没有 import，在文件开头插入
    ast.program.body.unshift(...newImports);
  }

  const output = generate(ast, {
    retainLines: false,
    compact: false,
  });

  return output.code;
}

/**
 * 向 @Module 装饰器的 imports 数组添加模块
 */
export function addModuleImports(
  code: string,
  moduleExpressions: string[],
): string {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy'],
  });

  let modified = false;

  traverse(ast, {
    Decorator(path) {
      // 查找 @Module 装饰器
      if (
        t.isCallExpression(path.node.expression) &&
        t.isIdentifier(path.node.expression.callee) &&
        path.node.expression.callee.name === 'Module'
      ) {
        const args = path.node.expression.arguments;
        if (args.length > 0 && t.isObjectExpression(args[0])) {
          const moduleConfig = args[0];
          
          // 查找 imports 属性
          const importsProperty = moduleConfig.properties.find(
            (prop) =>
              t.isObjectProperty(prop) &&
              t.isIdentifier(prop.key) &&
              prop.key.name === 'imports',
          );

          if (importsProperty && t.isObjectProperty(importsProperty)) {
            // imports 属性存在
            if (t.isArrayExpression(importsProperty.value)) {
              // 解析并添加新的模块表达式
              for (const expr of moduleExpressions) {
                try {
                  const exprAst = parser.parseExpression(expr, {
                    plugins: ['typescript'],
                  });
                  importsProperty.value.elements.push(exprAst);
                  modified = true;
                } catch (error) {
                  console.error(`Failed to parse expression: ${expr}`, error);
                }
              }
            }
          }
        }
      }
    },
  });

  if (!modified) {
    console.warn('Could not find @Module decorator or imports array');
    return code;
  }

  const output = generate(ast, {
    retainLines: false,
    compact: false,
  });

  return output.code;
}

/**
 * 安全地更新 app.module.ts 文件
 */
export async function updateAppModuleFile(
  filePath: string,
  imports: Array<{ from: string; imports: string[] }>,
  moduleExpressions: string[],
): Promise<void> {
  let code = await fs.readFile(filePath, 'utf-8');

  // 添加 import 语句
  if (imports.length > 0) {
    code = addImportToFile(code, imports);
  }

  // 添加模块注册
  if (moduleExpressions.length > 0) {
    code = addModuleImports(code, moduleExpressions);
  }

  // 写回文件
  await fs.writeFile(filePath, code, 'utf-8');
}
