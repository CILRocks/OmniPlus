export abstract class Command {
    /**
     * Command entry keyword
     *
     * @abstract
     * @type {string}
     * @memberof Command
     */
    public readonly abstract trigger: string
    /**
     * Provider identifier
     *
     * @abstract
     * @type {string}
     * @memberof Command
     */
    public readonly abstract providerID: string
    /**
     * Description of this command
     *
     * @abstract
     * @param {string} locale Current browser UI locale
     * @returns {string}
     * @memberof Command
     */
    public abstract description (locale: string): string
    /**
     * Fired when omni box user input changes
     *
     * @abstract
     * @param {string} text Omnibox content string excludes `trigger` or `commandID` prefix
     * @param {string} locale Current browser UI locale
     * @memberof Command
     */
    public abstract onInput (text: string, locale: string): void
    /**
     * Browser provided suggestion callback
     * Will be updated by Omni Plus core after user trigged this command
     *
     * @param {browser.omnibox.SuggestResult[]} suggesResults
     * @memberof Command
     */
    public suggest (suggesResults: browser.omnibox.SuggestResult[]) { }
    /**
     * User confirmed the runnig of this command
     *
     * @abstract
     * @param {string} locale Current browser UI locale
     * @param {string} [text] Omnibox content string excludes `trigger` or `commandID` prefix
     * @memberof Command
     */
    public abstract run (locale: string, text?: string): void
    /**
     * The index string used to help user search for this command
     * When indexed, `trigger`, `providerID`, `description` and `searchIndexString`
     * will be combined into a single searchable string
     *
     * @abstract
     * @param {string} locale
     * @returns {string}
     * @memberof Command
     */
    public abstract searchIndexString (locale: string): string
    /**
     * Return the combination of `trigger` and `providerID` for unique identifier
     *
     * @readonly
     * @type {string}
     * @memberof Command
     */
    public get commandID() : string {
        return `${this.trigger}.${this.providerID}`
    }

    constructor () { }
}
