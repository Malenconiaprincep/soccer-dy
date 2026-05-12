/**
 * 仓库内类型占位：在 Cocos Creator 工程中由引擎提供真实 `cc` 模块定义。
 */
declare module 'cc' {
  export const _decorator: {
    ccclass: (name?: string) => ClassDecorator;
    property: (...args: unknown[]) => PropertyDecorator;
  };
  export class Component {
    protected static __classname__?: string;
  }
}
