/*
   Copyright 2016 CIL (John Cido)

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/// <reference path="../../typings/index.d.ts" />

let async = require('async');
let _ = require('lodash');
let nerdamer = require('nerdamer');
let clipboard = require('clipboard-js');
let loremIpsum = require('lorem-ipsum');
//let convertPinyin = require('convertPinyin');
function i18n (name: string) { return chrome.i18n.getMessage(name); }

namespace Omnibox {
    chrome.omnibox.onInputChanged.addListener(inputChanged);
    chrome.omnibox.onInputEntered.addListener(inputAccepeted);
    chrome.omnibox.onInputCancelled.addListener(inputCancelled);

    let providers: providerItem[] = [];

    interface providerInfo {
        key: string,
        format?: {'reg': RegExp, 'info': string},
        description: string,
        input?: (content: string, suggest: (suggesResults: chrome.omnibox.SuggestResult[]) => void) => void,
        accept: (content?: string) => void,
        extensionId?: string
    }
    export function register(info: providerInfo) {
        providers.push(new providerItem(info));
    }
    export function deregister(id: string) {
        for (let provider of providers) {
            if (provider.extensionId) {
                if (provider.extensionId === id) provider._();
            }
        }
    }
    
    class providerItem {
        public key: string;
        public format?: {'reg': RegExp, 'info': string};
        public description: string;
        public input?: (content: string, suggest: (suggesResults: chrome.omnibox.SuggestResult[]) => void) => void;
        public accept: (content?: string) => void;
        public extensionId?: string;
        //misc functions and properties
        misc: any;
        
        constructor(info: providerInfo) {
            this.key = info.key;
            this.format = info.format ? info.format : null;
            this.description = info.description;
            this.input = info.input ? info.input : null;
            this.accept = info.accept;
            this.extensionId = info.extensionId ? info.extensionId : null;

            this.misc = {
                urlReg: /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi,
                encodeXml (str: string) {
                    let holder = document.createElement('div');
                    holder.textContent = str;
                    return holder.innerHTML;
                }
            }
        }

        search(data: any[], input: string, searchKeys: string[], suggestKeys: string[], callback: (response: chrome.omnibox.SuggestResult[]) => void, condition?: any[]) {
            let response: chrome.omnibox.SuggestResult[] = new Array();
            let self = this;
            data.forEach((item: any, index: number) => {
                let searchSample = '';
                let conditionMet = condition ? condition[1].includes(item[condition[0]]) : true;
                async.series([
                    function(cb: any) {
                        for(let i = 0, l = searchKeys.length; i < l; i++) {
                            let s: string = item[searchKeys[i]].toLowerCase();
                            searchSample += s + Pinyin.convert(s);
                            if(i === l - 1) cb();
                        }
                    },
                    function(cb: any) {
                        if (searchSample.includes(input) && conditionMet) response.push({ content: `${self.key } ${self.misc.encodeXml(item[suggestKeys[0]])}`, description: `${self.misc.encodeXml(item[suggestKeys[1]])}`});
                        if (index === data.length - 1 || response.length > 4) {
                            if (response.length === 0) response = [{ content: `${self.key } `, description: 'No matching result found'}];
                            callback(response);
                        }
                    }
                ])
            })
        }

        form(data: any[], suggestKeys: string[], callback: (response: chrome.omnibox.SuggestResult[]) => void) {
            let response = new Array();
            let self = this;
            data.length === 0 ? callback([{ content: `${self.key } `, description: 'No matching result found'}]) : data.forEach((item: any, index: number) => {
                response.push({ content: `${self.key } ${item[suggestKeys[0]]}`, description: `${self.misc.encodeXml(item[suggestKeys[1]])}`})
                if (index === data.length - 1)  callback(response);
            })
        }

        extract(content: string) {
            return content.replace(new RegExp('^\\s*'+ this.key + '\\b\\s*', 'i'), '');
            //return new RegExp('^\\s*'+ this.key + '\\b\\s*(\\.*)$', 'i').exec(content);
        }

        localize(type: 'des' | 'info') {
            return i18n(`key_${type}_${this.key.replace(' ', '_')}`);
        }

        _() {
            delete this;
        }
    }

    //omni input changed
    function inputChanged(text: string, suggest: (suggesResults: chrome.omnibox.SuggestResult[]) => void) {
        async.series([
            //got an exact key match
            function(cb: any) {
                let match = false;
                providers.forEach(function(provider: providerItem, index: number) {
                    if (text.includes(provider.key) && text.match(provider.key).index === 0) {
                    //if (new RegExp('^\\s*'+ this.key + '\\b\\s*', 'i').test(text)) {
                        match = true;
                        if (provider.input) provider.input(provider.extract(text), suggest);
                        else if (provider.format) {
                            if (!provider.format.reg.test(provider.extract(text))) suggest([{content: `${provider.key} `, description: `Correct format: {${provider.format.info}}`}]);
                            else suggest([{content: `${provider.key} `, description: provider.description}]);
                        } else suggest([{content: `${provider.key} `, description: provider.description}]);
                    } else {
                        if (index === providers.length - 1 && !match) {
                            cb();
                        }
                    }
                })
            },
            //find a possible key match
            function(cb: any) {
                let match = false;
                providers.forEach(function(provider, index) {
                    if (provider.key.includes(text) || provider.description.includes(text)) {
                        match = true;
                        suggest([{ content: provider.key, description: provider.description}]);
                    } else {
                        if (index === providers.length - 1 && !match) {
                            cb();
                        }
                    }
                })
            },
            //suggest a keys list
            function(cb: any) {
                let allCommands = new Array();
                providers.forEach(function(provider, index) {
                    allCommands.push({content: provider.key, description: provider.description});
                    if (index === providers.length - 1) {
                        suggest(allCommands);
                    }
                })
            }
        ])
    }
    //user accpeted suggestion
    function inputAccepeted(text: string) {
        //console.log('inputEntered: ' + text);
        let match = false;
        providers.forEach(function(provider, index) {
            if (text.includes(provider.key) && text.match(provider.key).index === 0) {
                match = true;
                if (provider.format) {
                    provider.format.reg.test(provider.extract(text)) ? provider.accept(provider.extract(text)) : Notification.error('Incorrect format', `Please use this format:\n{${provider.format}}`);
                } else provider.accept(provider.extract(text));
            } else {
                if (index === providers.length - 1 && !match) {
                    //let t = self.misc.encodeXml(text);
                    //window.open('https://www.google.com/webhp?hl=en&q=' + t + '#newwindow=1&hl=en&q=' + t);
                    Notification.send("Sorry", "I can't understand that yet.", 'confuse');
                }
            }
        });
    }
    //user cancelled the session
    function inputCancelled() {
        
    }
}

namespace Notification {
    export function send(title?: string, message?: string, icon?: string, progress?: number, id?: string) {
        chrome.notifications.create(id ? id : 'id', {
            type: progress ? 'progress' : 'basic',
            iconUrl: icon ? `/img/notifications/icon_${icon}.png` : '/img/icons/icon_128.png',
            title: title ? title : ' ',
            message: message ? message : ' ',
            progress: progress ? progress : null
        }, id => { });
    }

    export function log(title?: string, message?: string) {
        send(title, message, 'log');
    }

    export function error(title?: string, message?: string) {
        send(title, message, 'error');
    }

    export function warning(title?: string, message?: string) {
        send(title, message, 'warning');
    }

    export function debug(title?: string, message?: string) {
        send(title, message, 'debug');
    }

    export function done(title?: string, message?: string) {
        send(title, message, 'done');
    }
}

namespace Messaging {
    chrome.runtime.onMessage.addListener(onMessage);

    interface registerMessage {
        goal: string,
        key?: string,
        format?: { reg: RegExp, info: string },
        description?: string
    }
    function onMessage(message: registerMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
        if (sender.id) {
            Management.validateId(sender.id, (valid, info) => {
                if (valid && /register|unregister/.test(message.goal)) {
                    switch (message.goal) {
                        case 'register':
                            try {
                                Omnibox.register({
                                    key: `/${message.key}`,
                                    format: message.format ? message.format : null,
                                    description: message.description,
                                    extensionId: sender.id,
                                    input: message.format ? null : function(content, suggest) {
                                        let self = this;
                                        send(self.extensionId, {
                                            from: 'omniPlus',
                                            type: 'input',
                                            content: content
                                        }, (response: chrome.omnibox.SuggestResult[]) => {
                                            suggest(response);
                                        })
                                    },
                                    accept (content) {
                                        let self = this;

                                        interface accpetResponse {
                                            error?: string
                                        }
                                        send(self.extensionId, {
                                            from: 'omniPlus',
                                            type: 'accept',
                                            content: content
                                        }, (response: accpetResponse) => {
                                            if (response.error) Notification.error('External command error', `Details: ${response.error}`);
                                        })
                                    }
                                });
                                sendResponse({ success: true });
                            } catch (e) {
                                sendResponse({ success: false, error: e ? e : 'Provider register failed.' });
                            }
                            break;
                        case 'deregister':
                            Omnibox.deregister(sender.id);
                            break;
                    }
                }
            })
        }
    }
    
    export function send(id: string, message: any, callback?: (reponse: any) => void) {
        chrome.runtime.sendMessage(id, message, (response: any) => {
            if (callback) callback(response);
        });
    }
}

namespace Management {
    let selfId: string;
    chrome.management.getSelf((info: chrome.management.ExtensionInfo) => { selfId = info.id });

    //listening unintsall and disable events to deregister any provider if apply
    chrome.management.onUninstalled.addListener(id => { Omnibox.deregister(id) });
    chrome.management.onDisabled.addListener(info => { Omnibox.deregister(info.id) });
    //query all extensions for possible command register
    chrome.management.getAll((result: chrome.management.ExtensionInfo[]) => {
        for (let info of result) {
            if (info.enabled) Messaging.send(info.id, { goal: 'omniPlusQuery' });
        }
    });

    //validate an id
    export function validateId(id: string, callback: (valid: boolean, info?: chrome.management.ExtensionInfo) => void) {
        chrome.management.get(id, (result: chrome.management.ExtensionInfo) => {
            result ? callback(true, result) : callback(false, null);
        })
    }

    //launch an app
    Omnibox.register({
        key: 'ext launch',
        description: 'Launch an app',
        input (content, suggest) {
            let self = this;
            chrome.management.getAll((result: chrome.management.ExtensionInfo[]) => {
                self.search(result, content, ['name', 'shortName', 'description'], ['id', 'name'], (response: any) => {
                    suggest(response);
                }, ['type', ["hosted_app", "packaged_app", "legacy_packaged_app"]]);
            });
        },
        accept (id) {
            validateId(id, (valid, info) => {
                if (valid) {
                    info.enabled ? chrome.management.launchApp(id, function() { }) : Notification.error(`App disabled`, `Please enable the app and try again.`);
                } else Notification.error(`Invalid id`, `Please provide a valid app id`);
            });
        }
    });

    //toggle an exntension's enabled state
    Omnibox.register({
        key: 'ext toggle',
        description: "Toggle an extension's enable state",
        input (content, suggest) {
            let self = this;
            chrome.management.getAll((result: chrome.management.ExtensionInfo[]) => {
                self.search(result, content, ['name', 'shortName', 'description'], ['id', 'name'], (response: any) => {
                    suggest(response);
                }, ['type', ["extension", "hosted_app", "packaged_app", "legacy_packaged_app", "theme"]]);
            });
        },
        accept (id) {
            validateId(id, (valid, info) => {
                if (valid) {
                    selfId === id ? Notification.warning("Can't disable myself", "If you want to disable Omni Plus, please head to extensions page and disable it manually") : chrome.management.get(id, (info: chrome.management.ExtensionInfo) => {
                        Notification.send(`${info.enabled ? "Disabled" : "Enabled"}`, `${info.name}`, 'extension');
                        chrome.management.setEnabled(id, !info.enabled);
                    });
                } else Notification.error(`Invalid id`, `Please provide a valid extension id`);
            });
        }
    });
}

namespace BrowserBasic {
    //Bookmark
    //delete bookmark
    Omnibox.register({
        key: 'bookmark delete',
        description: 'Delete a specific bookmark',
        input (content, suggest) {
            let self = this;
            if (content !== '' && content.length > 1) {
                chrome.bookmarks.search(self.misc.encodeXml(content), (results: chrome.bookmarks.BookmarkTreeNode[]) => {
                    self.form(results, ['id', 'title'], (response: any) => {
                        suggest(response);
                    });
                });
            } else suggest([{ content: `${self.key} `, description: `Type more to begin search`}]);
        },
        accept (content) {
            let self = this;
            chrome.bookmarks.get(content, (r: chrome.bookmarks.BookmarkTreeNode[]) => {
                if (r) chrome.bookmarks.remove(content, () => { Notification.send('Bookmark removed', `${self.misc.encodeXml(r[0].title)}`, 'bookmark')});
                else Notification.error('No matching id', 'The provided bookmark id is invalid');
            })
        }
    });

    //History
    //delete all history of given url
    Omnibox.register({
        key: 'history delete',
        description: 'Delete all history of given url',
        input (content, suggest) {
            let self = this;
            if (content !== '' && content.length > 1) {
                chrome.history.search({
                    text: self.misc.encodeXml(content),
                    maxResults: 5
                }, (results: chrome.history.HistoryItem[]) => {
                    self.form(results, ['url', 'title'], (response: any) => {
                        suggest(response);
                    });
                })
            } else suggest([{ content: `${self.key} `, description: `Type more to begin search`}]);
        },
        accept (content) {
            let self = this;
            if (self.misc.urlReg.test(content)) {
                chrome.history.deleteUrl({url: content}, () => {
                    Notification.send(`Deletion complete`, `All histories that matche ${content} were deleted.`, 'history');
                })
            } else Notification.error(`Invalid url`, `Please provide valid url for the operation.`)
        }
    });

    //open one of the top sites
    Omnibox.register({
        key: 'top',
        description: 'Open one of your top visited sites',
        input (content, suggest) {
            let self = this;
            chrome.topSites.get((data: Array<chrome.topSites.MostVisitedURL>) => {
                if (content !== '') {
                    self.search(data, content, ['title', 'url'], ['url', 'title'], (response: any[]) => {
                        suggest(response);
                    });
                } else {
                    self.form(data, ['url', 'title'], (response: any) => {
                        suggest(response);
                    });
                }
            })
        },
        accept (content) {
            let self = this;
            content.replace(' ', '');
            if (self.misc.urlReg.test(content)) window.open(content);
            else Notification.error('Invalid url', 'Please double check provoded url');
        }
    });

    //Tabs
    //go to an open tab
    Omnibox.register({
        key: 'tab goto',
        description: 'Go to another opened tab',
        input (content, suggest) {
            let self = this;
            if (content.length > 0) {
                chrome.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
                    self.search(tabs, content, ['title', 'url'], ['id', 'title'], (response: any[]) => {
                        suggest(response);
                    });
                })
            } else suggest([{ content: `${self.key} `, description: `Type more to begin search`}]);
        },
        accept (content) {
            try {
                let id = parseInt(content);
                chrome.tabs.get(id, (tab: chrome.tabs.Tab) => {
                    tab ? chrome.tabs.update(id, { active: true }) : Notification.error(`Invalid Tab id`);
                });
            } catch (e) {
                Notification.error(`Invalid Tab id`, `I couldn't find a tab with id ${content}.`);
            }
        }
    });

    //EXPERIMENT
    //@credit: https://fossbytes.com/complete-list-of-secret-chrome-urls-uses/
    let chromeUrls = require('../js/data/chromeUrls.json');
    //Chrome urls
    Omnibox.register({
        key: 'chrome url',
        description: "Copy the Chrome url you're looking for",
        input (content, suggest) {
            let self = this;
            self.search(chromeUrls, content, ['url', 'description'], ['url', 'description'], (response: any[]) => {
                suggest(response);
            });
        },
        accept (content) {
            clipboard.copy(content);
            Notification.log(content, 'Copied to clipboard');
        }
    })
}

namespace Time {
    Omnibox.register({
        key: 'reminder after',
        format: { reg: /^([1-9]|[1-9]\d+)\s*([sm])\s*(.*)?$/i, info: 'count(>0) unit(s: seconds, m: minutes) content?' },
        description: 'Set a reminder after some time with optional text content',
        accept (content) {
            let self = this;
            let exec = self.format.reg.exec(content);
            let count = parseFloat(exec[1]);
            let unit = exec[2];
            let text = exec[3] ? exec[3] : `Your ${exec[1]+exec[1]} reminder.`;
            setTimeout(() => {
                Notification.send('Reminder', text, 'reminder');
            }, 1000 * (unit === 's' ? count : count * 60));
            //console.log(self.reg.exec(content));
        }
    })
}

namespace Misc {
    //display system memory capacity
    Omnibox.register({
        key: 'memory',
        description: 'Current system memory usage information',
        accept (content) {
            let self = this;
            chrome.system.memory.getInfo((info: chrome.system.memory.MemoryInfo) => {
                let left = parseFloat((info.availableCapacity/1024/1024/1024).toFixed(2));
                let total = Math.round(info.capacity/1024/1024/1024);
                Notification.send(
                    `${left}GB left`,
                    `Total of ${total}GB system memory.\nFor more acurate info, please check out system activity monitor or any utility app.`,
                    'memory',
                    Math.round(100 - (left * 100 / total)));
            })
        }
    })

    //download and save as
    Omnibox.register({
        key: 'download to',
        description: 'Donwload and save file to...',
        input (content, suggest) {
            let self = this;
            if (!self.misc.urlReg.test(content))
                suggest([{ content: `${this.key} http`, description: 'Please provide a valid url'}]);
        },
        accept (content) {
            let self = this;
            if (self.misc.urlReg.test(content)) {
            let self = this;
                chrome.downloads.download({ url: content, saveAs: true });
            } else Notification.error(`No valid url found`, `Please provide a valid url address to begin a new download.`);
        }
    });

    //toggle downloads shelf
    Omnibox.register({
        key: 'download shelf hide',
        description: 'Hide downloads shelf',
        accept (content) {
            chrome.downloads.setShelfEnabled(false);
            Notification.send('Shelf hided', 'Now the shelf is gone, enjoy your bigger tab space.', 'download');
        }
    })
    Omnibox.register({
        key: 'download shelf show',
        description: 'Show downloads shelf',
        accept (content) {
            try {
                chrome.downloads.setShelfEnabled(true);
                Notification.send('Shelf is back', "Notice: If it's not showing, this setting might be overrided by other extensions.", 'download');
            } catch (e) {
                console.log(e);
                Notification.error('Operation failed', 'Another exntension might made shelf invisible, please turn that off and try again.');
            }
        }
    })

    //Text related
    //read text
    Omnibox.register({
        key: 'text read',
        description: 'Read text using browser text to speak engine',
        input (content, suggest) {
            if (content.length > 32768) suggest([{ content: `${this.key} `, description: 'Maximum length exceeded, please simplify the text'}]);
        },
        accept (content) {
            if (content.length > 32768) Notification.error('Maximum length exceeded', 'Please consider simplify the text');
            else chrome.tts.speak(content, {
                enqueue: false,
                gender: 'female'
            }, () => { })
        }
    });

    //clear your clipboard
    Omnibox.register({
        key: 'clipboard clear',
        description: 'Clear your clipboard',
        accept (content) {
            clipboard.copy('');
            Notification.send('Clip board cleared', null, 'clipboard');
        }
    })

    //generate random dummy text
    Omnibox.register({
        key: 'text random',
        format: { reg: /^([1-9]|\[1-9]\d+)\s*([wsp])\s*$/i, info: 'count(>0) unit(w: words, s: sentences, p: paragraphs)' },
        description: 'Generate random lorem-ipsum text',
        accept (content) {
            let self = this;
            //dictionary of all units
            interface unitsDict {
                [key: string]: string
            };
            let unitsDict: unitsDict = {
                w: 'words',
                s: 'sentences',
                p: 'paragraphs'
            };

            let exec = self.format.reg.exec(content);
            let count: number = parseInt(exec[1]);
            let unit: string = unitsDict[exec[2]]
            clipboard.copy(loremIpsum({ count: count, units: unit }));
            Notification.send('Random text generated', `Generated ${count} ${unit}.\nCopied to your clipboard`, 'random-text');
        }
    });

    //Math stuff
    //caculate math expression
    Omnibox.register({
        key: 'calculate',
        format: { reg: /^(?:\d+\s*[/\+\-\*\(\)\^])+\s*(?:\d+)\)*\s*$/, info: 'basic math expression with +-*/^() operators' },
        description: 'Calculate a math expression',
        accept (content) {
            try {
                content.replace(/\s*/g, '');
                let expression = nerdamer(content);
                let result = expression.evaluate().text();
                Notification.send(result, `Is the result of ${content}\nCopied to your clipboard.`, 'calculate');
                clipboard.copy(result);
            } catch (e) {
                Notification.error(`Unable to calculate ${content}`, `Details: ${e ? e : 'Invalid expression.'}`);
            }
        }
    });

    //solve math equation
    /*Omnibox.register({
        key: 'solve',
        description: 'Solve a math equation',
        input (equation: string, suggest: any) {
            if (!equation.includes(' '))
                suggest([{ content: `${this.key} equation x`, description: 'Please use space to seperate the equation and variable'}]);
        },
        accept(content: string) {
            try {
                let parts = content.split(' ');
                let sol = nerdamer.solveEquations(parts[0], parts[1]);
                window.alert(sol);
            } catch (e) {
                console.log(e);
            }
        }
    })*/
}

/*
@credit: tosone
@github: https://github.com/tosone/convertPinyin
Modification made
*/
namespace Pinyin {
    let pinyinData = require('../js/data/convertPinyin.json');

    export function convert(str: string, join?: string) {
        let joint = join ? join : '';
        if (str.match(/[\u3400-\u9FBF]/)) {
            let cn = str.replace(/[^\u4e00-\u9fa5]/gi,"");
            return get(cn).join(joint);
        } else return str
    }

    export function get(str: string) {
        this.isZh = false;
        let ret = new Array();
        let reg = new RegExp('[a-zA-Z0-9\- ]');
        if (str && str.length !== 0) {
        _.forEach(str, (val: any) => {
            if (reg.test(val)) {
            if (ret.length !== 0 && !this.isZh) {
                ret.push(ret.pop() + val);
            } else {
                this.isZh = false;
                ret.push(val);
            }
            } else {
            let name = search(val);
            if (name) {
                this.isZh = true;
                ret.push(name);
            }
            }
        });
        }
        return ret;
    }

    function search(str: string) {
        let once = true;
        let ret: any = null;
        _.forEach(pinyinData, (val: any, key: any) => {
        if (once && val.indexOf(str) !== -1) {
            once = false;
            ret = key;
        }
        });
        return ret;
    }
}