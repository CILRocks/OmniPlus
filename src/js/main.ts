import {
    Core
} from './core'

const browserTarget = $$TARGET$$
const core = new Core(browserTarget)

// Set up omni plus core
browserTarget.omnibox.onInputStarted.addListener(core.inputStarted)
browserTarget.omnibox.onInputChanged.addListener(core.inputChanged)
browserTarget.omnibox.onInputEntered.addListener(core.inputAccepeted)
browserTarget.omnibox.onInputCancelled.addListener(core.inputCancelled)
