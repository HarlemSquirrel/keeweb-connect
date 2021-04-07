import { OptionsPageMessage } from 'common/options-page-interface';
import { backend } from './backend';
import { BackgroundMessageFromPage } from 'common/background-interface';
import { openTab } from './utils';
import { noop } from 'common/utils';

const connectedPorts = new Map<string, chrome.runtime.Port>();

function startInternalIpc(): void {
    chrome.runtime.onConnect.addListener((port) => {
        if (
            !port.sender.url?.startsWith(location.origin) ||
            !port.sender.tab?.url?.startsWith(location.origin)
        ) {
            return;
        }

        if (!port.name) {
            return;
        }

        connectedPorts.set(port.name, port);

        port.onMessage.addListener(async (message) => {
            await processMessage(message as BackgroundMessageFromPage);
        });
        port.onDisconnect.addListener(() => {
            connectedPorts.delete(port.name);
        });

        sendFirstMessage(port);
    });

    backend.on('state-changed', () => {
        for (const port of connectedPorts.values()) {
            const msg: OptionsPageMessage = {
                backendConnectionState: backend.state,
                backendConnectionError: backend.connectionError
            };
            port.postMessage(msg);
        }
    });
}

async function processMessage(message: BackgroundMessageFromPage) {
    if (message.connectToKeeWeb) {
        backend.connect().catch(noop);
    } else if (message.lockWorkspace) {
        await backend.lockWorkspace();
    } else if (message.openTab) {
        await openTab(message.openTab);
    }
}

function sendFirstMessage(port: chrome.runtime.Port) {
    const msg: OptionsPageMessage = {
        backendConnectionState: backend.state,
        backendConnectionError: backend.connectionError
    };
    port.postMessage(msg);
}

export { startInternalIpc };
