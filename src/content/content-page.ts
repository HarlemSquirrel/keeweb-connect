import {
    ContentScriptMessage,
    ContentScriptMessageAutoFill,
    ContentScriptReturn
} from 'common/content-script-interface';

declare global {
    interface Window {
        kwExtensionInstalled: boolean;
    }
}

if (!window.kwExtensionInstalled) {
    window.kwExtensionInstalled = true;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (sender.id !== chrome.runtime.id) {
            return;
        }

        const response = run(message as ContentScriptMessage);
        if (response) {
            sendResponse(response);
        }

        function run(message: ContentScriptMessage): ContentScriptReturn | undefined {
            if (location.href !== message.url) {
                return;
            }
            switch (message.action) {
                case 'auto-fill':
                    autoFill(message);
                    break;
                case 'get-next-auto-fill-command':
                    return getNextAutoFillCommand();
            }
        }

        function getNextAutoFillCommand() {
            const input = <HTMLInputElement>document.activeElement;
            if (input?.tagName !== 'INPUT') {
                return;
            }

            let nextCommand;
            if (input.type === 'password') {
                nextCommand = 'submit-password';
            } else {
                const passInput = getNextFormPasswordInput(input);
                if (passInput) {
                    nextCommand = 'submit-username-password';
                } else {
                    nextCommand = 'submit-username';
                }
            }
            return { nextCommand };
        }

        function autoFill(arg: ContentScriptMessageAutoFill) {
            const { text, password, submit } = arg;

            let input = <HTMLInputElement | undefined>document.activeElement;
            if (!input) {
                return;
            }

            if (!text) {
                return;
            }

            setInputText(input, text);

            const form = input.form;

            if (password) {
                input = getNextFormPasswordInput(input);
                if (!input) {
                    return;
                }

                input.focus();
                setInputText(input, password);
            }

            if (form && submit) {
                submitForm(form);
            }
        }

        function setInputText(input: HTMLInputElement, text: string) {
            input.value = text;
            input.dispatchEvent(
                new InputEvent('input', { inputType: 'insertFromPaste', data: text, bubbles: true })
            );
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function getNextFormPasswordInput(input: HTMLInputElement): HTMLInputElement | undefined {
            if (!input.form) {
                const inputs = [...document.querySelectorAll('input')];
                if (!inputs.includes(input)) {
                    return undefined;
                }
                for (let ix = inputs.indexOf(input) + 1; ix < inputs.length; ix++) {
                    const nextInput = inputs[ix] as HTMLInputElement;
                    if (nextInput.form) {
                        return undefined;
                    }
                    switch (nextInput.type) {
                        case 'password':
                            return nextInput;
                        case 'checkbox':
                        case 'hidden':
                            continue;
                        default:
                            return undefined;
                    }
                }
                return undefined;
            }
            let found = false;
            for (const element of input.form.elements) {
                if (found) {
                    if (element.tagName === 'INPUT') {
                        const inputEl = element as HTMLInputElement;
                        if (inputEl.type === 'password') {
                            return inputEl;
                        }
                    }
                }
                if (element === input) {
                    found = true;
                }
            }
            return undefined;
        }

        function submitForm(form: HTMLFormElement) {
            const submitButton = <HTMLInputElement | undefined>(
                form.querySelector('input[type=submit],button[type=submit]')
            );
            if (typeof form.requestSubmit === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                form.requestSubmit(submitButton);
            } else if (submitButton) {
                submitButton.click();
            } else {
                const btn = document.createElement('input');
                btn.type = 'submit';
                btn.hidden = true;
                form.appendChild(btn);
                btn.click();
                form.removeChild(btn);
            }
        }
    });
}

export {};
