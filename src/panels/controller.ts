import { Webview, commands } from "vscode";
import Extension from "../utils/extension";
import { showWaringMsg, RegisterInfo, showErrMsg, ExtensionPackage } from "../utils";
import { ExtensionManagerPanel } from "./ExtensionManagerPanel";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
export enum Cmd {
    deleteExtension,
    getExtensions,
    showErrMsg,
    createExtensionPack
}


class Res {
    public success: boolean;
    constructor(success: boolean) {
        this.success = success;
    }
}


export class Msg {
    public cmd: Cmd;
    public data: string;
    public callBacKId: string | undefined;

    constructor(msg: Msg, cmd: Cmd, data: object) {
        this.cmd = cmd;
        this.data = JSON.stringify(data);
        this.callBacKId = msg.callBacKId;
    }
}


export function controller(msg: Msg, webview: Webview) {
    switch (msg.cmd) {
        case Cmd.deleteExtension:
            deleteExtension(msg, webview);
            break;
        case Cmd.getExtensions:
            getExtensions(msg, webview);
            break;
        case Cmd.showErrMsg:
            showErrMsg(msg.data);
            break;
        case Cmd.createExtensionPack:
            createExtensionPack(msg, webview);
        default:
            break;
    }
}

async function deleteExtension(msg: Msg, webview: Webview) {
    const data = <Extension>JSON.parse(msg.data);
    const select = await showWaringMsg("Are you sure? This action will permanently delete this extension pack.", "Yes", "No");
    if (select === "Yes") {
        Extension.deleteExtension(ExtensionManagerPanel.extensionRootPath, data.pck, () => {
            webview.postMessage(new Msg(msg, Cmd.deleteExtension, new Res(true)));
            commands.executeCommand("workbench.extensions.action.refreshExtension");
        });
    }
}

function getExtensions(msg: Msg, webview: Webview) {
    function extensionId(pck: ExtensionPackage): string {
        return pck.publisher + "." + pck.name;
    }
    const extensionRegisterInfos = <RegisterInfo[]>JSON.parse(readFileSync(join(ExtensionManagerPanel.extensionRootPath, "extensions.json"), "utf-8"));
    let extensions = <Extension[]>extensionRegisterInfos.map(item => Extension.readFromFile(ExtensionManagerPanel.extensionRootPath, item.relativeLocation));
    extensions = extensions.filter(e =>
                                    e && /* e存在*/
                                    (!e.pck.categories || e.pck.categories[0] !== "Language Packs") && /*不是语言包 */
                                    extensionId(e.pck) !== "bloodycrown.simple-extension-manager"); /*不是extension Manager */
    //过滤掉extensionPack中不存在的extension    
    const tmpExtensionsId = extensions.map(m=>extensionId(m.pck));
    extensions.forEach(f=>{
        const extensionPack = f.pck.extensionPack;
       !extensionPack||(f.pck.extensionPack = extensionPack.filter(id=>tmpExtensionsId.includes(id)));
    });
    webview.postMessage(new Msg(msg, Cmd.getExtensions, extensions));
}

async function createExtensionPack(msg: Msg, webview: Webview) {
    function extensionDirName(pck: ExtensionPackage) {
        return pck.publisher + '.' + pck.name + '-1.0.0';
    }
    const res = JSON.parse(msg.data) as { extension: Extension, isUpdate: boolean };
    const newExtensionPck = ExtensionPackage.copy(res.extension.pck);
    const select = await showWaringMsg(`Confirm that you'd like to ${res.isUpdate ? "update" : "create"} extension`, "Yes", "No");
    if (select === "Yes") {
        if (res.isUpdate && res.extension.pck.name) {
            newExtensionPck.name = res.extension.pck.name;
            newExtensionPck.updatePackage(join(ExtensionManagerPanel.extensionRootPath, extensionDirName(res.extension.pck)),
                res.extension.img.replace(/data:.*?;base64,/g, '') || undefined,
                () => {
                    webview.postMessage(new Msg(msg, Cmd.createExtensionPack, new Res(true)));
                    commands.executeCommand("workbench.extensions.action.refreshExtension");
                });
        }
        else {
            const finalExtension = new Extension(newExtensionPck, ExtensionManagerPanel.extensionRootPath);
            finalExtension.img = res.extension.img.replace(/data:.*?;base64,/g, '');
            finalExtension.createExtension(() => {
                webview.postMessage(new Msg(msg, Cmd.createExtensionPack, new Res(true)));
                commands.executeCommand("workbench.extensions.action.refreshExtension");
            });
        }
    }
}