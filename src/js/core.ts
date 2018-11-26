import { Command } from './command'

export class Core {
    /**
     * Current browser instance
     *
     * @private
     * @type {typeof browser}
     * @memberof Core
     */
    private browserTarget: typeof browser
    /**
     * Current browser UI language
     *
     * @private
     * @type {string}
     * @memberof Core
     */
    private locale: string = 'en'
    /**
     * Commands registry
     *
     * @private
     * @type {{[trigger: string]: Command}}
     * @memberof Core
     */
    private commands: {[trigger: string]: Command} = {}

    constructor (target: typeof browser) {
        this.browserTarget = target
        this.locale = this.browserTarget.i18n.getUILanguage()
    }

    /**
     * Omni input started
     */
    public inputStarted () {

    }

    /**
     * Omni input changed
     *
     * @param {string} text
     * @param {(suggesResults: browser.omnibox.SuggestResult[]) => void} suggest
     * @memberof OmniPlusCore
     */
    public inputChanged (text: string, suggest: (suggesResults: browser.omnibox.SuggestResult[]) => void) { }

    /**
     * Suggestion accepted
     *
     * @param {string} text
     * @memberof OmniPlusCore
     */
    public inputAccepeted (text: string) { }

    /**
     * User cancelled the omni session
     *
     * @memberof OmniPlusCore
     */
    public inputCancelled () { }

    /**
     * Register a command
     *
     * @param {Command} command
     * @memberof Core
     */
    public register (command: Command) {
        const possibleCurrentCommand = this.commands[command.trigger]
        if (!possibleCurrentCommand) {
            this.commands[command.trigger] = command
        } else if (possibleCurrentCommand.commandID !== command.commandID) {
            this.commands[command.commandID] = command
        }
    }

    /**
     * Unregister a command
     *
     * @param {Command} command
     * @memberof Core
     */
    public unregister (command: Command) {
        if (this.commands[command.trigger]) {
            delete this.commands[command.trigger]
        } else {
            delete this.commands[command.commandID]
        }
    }
}
