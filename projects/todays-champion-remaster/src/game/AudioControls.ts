export type AudioSettings = { bgm: number; sfx: number; bgmMuted: boolean; sfxMuted: boolean };
type Placement = { x: number; y: number; size: number };
type AudioScreen = 'default' | 'select';
const defaults = (): Record<AudioScreen, { button: Placement }> => ({ default: { button: { x: 865, y: 280, size: 110 } }, select: { button: { x: 805, y: 105, size: 110 } } });
const clamp = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function readAudioSettings(storage: Pick<Storage, 'getItem'>): AudioSettings {
    let data: Partial<AudioSettings> = {};
    try { data = JSON.parse(storage.getItem('tc-audio-settings-v1') || '{}') || {}; } catch { /* 保存が使えない端末でも初期音量で遊べる。 */ }
    return { bgm: clamp(data.bgm, 35, 0, 100), sfx: clamp(data.sfx, 100, 0, 100), bgmMuted: data.bgmMuted === true, sfxMuted: data.sfxMuted === true };
}

export class AudioControls {
    settings: AudioSettings;
    private layout = defaults();
    private screen: AudioScreen = 'default';
    private renderTuner?: () => void;
    private root = document.createElement('div');
    private style = document.createElement('style');
    private tuner?: HTMLDetailsElement;
    private opener = document.createElement('button');
    private overlay = document.createElement('div');
    private dialog = document.createElement('section');
    private close = document.createElement('button');
    private opened = false;
    private previousFocus?: HTMLElement;
    private resize: ResizeObserver;
    private events = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'touchcancel', 'click', 'wheel', 'keydown', 'keyup'];
    // bodyの音声アンロックは通し、windowのPhaser入力へだけ届かせない。
    private block = (event: Event) => { if (this.opened || (event.target instanceof Node && (this.root.contains(event.target) || this.tuner?.contains(event.target)))) event.stopPropagation(); };
    private keyboard = (event: KeyboardEvent) => {
        if (!this.opened) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.setOpen(false); }
        if (event.key === 'Tab') {
            const items = Array.from(this.dialog.querySelectorAll<HTMLElement>('button,input'));
            const index = items.indexOf(document.activeElement as HTMLElement);
            event.preventDefault(); items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
        }
    };
    constructor(private canvas: HTMLCanvasElement, debug: boolean, private changed: () => void, private modalChanged: (open: boolean) => void = () => {}) {
        this.settings = readAudioSettings({ getItem: key => localStorage.getItem(key) });
        if (debug) {
            try {
                // 全画面共通だった旧配置を引き継ぐと、セレクト用の値が他画面にも漏れる。
                const saved = JSON.parse(localStorage.getItem('tc-audio-layout-v3') || '{}');
                for (const screen of ['default', 'select'] as const) for (const key of ['x', 'y', 'size'] as const) {
                    this.layout[screen].button[key] = clamp(saved?.[screen]?.button?.[key], this.layout[screen].button[key], key === 'size' ? 64 : 0, key === 'x' ? 941 : key === 'y' ? 1672 : 220);
                }
            } catch { /* デバッグ配置の破損は本番の初期配置に戻す。 */ }
        }
        this.root.className = 'tc-audio';
        this.style.textContent = `
            .tc-audio button{color:#fff1c6;border:1px solid #c3a364;background:linear-gradient(145deg,#172a3e,#120f21);cursor:pointer;touch-action:manipulation}
            .tc-audio button:focus-visible,.tc-audio input:focus-visible{outline:3px solid #7ee4ff;outline-offset:3px}
            .tc-audio [hidden]{display:none!important}
            .tc-audio-open{position:fixed;z-index:9000;border-radius:14px;font:32px Georgia,serif;box-shadow:0 3px 12px #000a}
            .tc-audio-overlay{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;box-sizing:border-box;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:#030713c9;overscroll-behavior:contain;touch-action:none}
            .tc-audio-dialog{position:relative;box-sizing:border-box;width:min(420px,100%);max-height:100%;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:28px 24px;border:1px solid #b99a60;border-radius:22px;background:linear-gradient(145deg,#162238,#090c18);box-shadow:0 16px 70px #000c;color:#fff1c6;font:16px Arial,sans-serif}
            .tc-audio-dialog h2{font-size:22px;letter-spacing:2px;margin:4px 56px 8px 0}.tc-audio-dialog p{font-size:13px;color:#b7bfd0;margin:0 0 24px;line-height:1.6}
            .tc-audio-close{position:absolute;right:14px;top:14px;width:48px;height:48px;border-radius:12px;font:30px Arial}
            .tc-audio-channel{padding:18px 0;border-top:1px solid #c3a36440}.tc-audio-channel header{display:flex;align-items:center;justify-content:space-between;gap:12px}.tc-audio-channel strong{font-size:18px}.tc-audio-channel button{min-width:132px;min-height:48px;padding:8px 12px;border-radius:12px;font:14px Arial}
            .tc-audio-channel button[aria-pressed=true]{color:#ff9db2;border-color:#d77491}.tc-audio-channel .note{display:inline-block;position:relative;margin-right:10px;font-size:24px;vertical-align:middle}.tc-audio-channel .cross{position:absolute;left:-4px;top:-3px;font:bold 28px Arial;color:#ff849c}
            .tc-audio-channel input{display:block;box-sizing:border-box;width:100%;height:48px;margin:16px 0 0;padding:0;accent-color:#e4c47b;cursor:pointer;touch-action:none;-webkit-appearance:none;appearance:none;background:transparent}
            .tc-audio-channel input::-webkit-slider-runnable-track{height:10px;border-radius:8px;background:#4b5062}.tc-audio-channel input::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:30px;margin-top:-10px;border:3px solid #fff1c6;border-radius:50%;background:#c2a05a;box-shadow:0 2px 8px #0009}
            .tc-audio-channel input::-moz-range-track{height:10px;border-radius:8px;background:#4b5062}.tc-audio-channel input::-moz-range-thumb{width:26px;height:26px;border:3px solid #fff1c6;border-radius:50%;background:#c2a05a}
            .tc-audio-channel output{display:block;text-align:right;font-size:16px;font-variant-numeric:tabular-nums}
            .tc-audio-tuner{position:fixed;z-index:10010;left:12px;bottom:12px;width:260px;max-height:50vh;overflow:auto;box-sizing:border-box;padding:10px;border:1px solid #aa9765;background:#080e1ff2;color:#fff1c6;font:12px Arial}.tc-audio-tuner summary{cursor:pointer;font-weight:bold}.tc-audio-tuner label{display:grid;grid-template-columns:45px 1fr 58px;align-items:center;gap:4px;margin:7px 0}.tc-audio-tuner input{min-width:0;width:100%;box-sizing:border-box}.tc-audio-tuner button{width:100%;margin:5px 0}.tc-audio-tuner textarea{width:100%;height:70px;box-sizing:border-box}`;
        document.head.appendChild(this.style); document.body.appendChild(this.root);
        this.opener.className = 'tc-audio-open'; this.opener.type = 'button'; this.opener.textContent = '♪';
        this.opener.setAttribute('aria-label', '音量設定を開く'); this.opener.setAttribute('aria-haspopup', 'dialog'); this.opener.setAttribute('aria-expanded', 'false');
        this.opener.onclick = () => this.setOpen(true);
        this.overlay.className = 'tc-audio-overlay'; this.overlay.hidden = true;
        this.dialog.className = 'tc-audio-dialog'; this.dialog.setAttribute('role', 'dialog'); this.dialog.setAttribute('aria-modal', 'true'); this.dialog.setAttribute('aria-label', '音量設定');
        this.close.type = 'button'; this.close.className = 'tc-audio-close'; this.close.textContent = '×'; this.close.setAttribute('aria-label', '音量設定を閉じる'); this.close.onclick = () => this.setOpen(false);
        const title = document.createElement('h2'); title.textContent = 'SOUND';
        const description = document.createElement('p'); description.textContent = '音量設定　／　×でゲームに戻る';
        this.dialog.append(this.close, title, description); this.overlay.appendChild(this.dialog); this.root.append(this.opener, this.overlay);
        for (const channel of ['bgm', 'sfx'] as const) {
            const row = document.createElement('section'); row.className = 'tc-audio-channel';
            const button = document.createElement('button'); button.type = 'button';
            button.innerHTML = `<span class="note" aria-hidden="true">♪<span class="cross" hidden>×</span></span><span class="mute-label"></span>`;
            const header = document.createElement('header'), name = document.createElement('strong'); name.textContent = channel === 'bgm' ? 'BGM' : '効果音'; header.append(name, button);
            const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '1'; slider.value = String(this.settings[channel]); slider.setAttribute('aria-label', channel === 'bgm' ? 'BGM音量' : '効果音音量');
            const value = document.createElement('output');
            const refresh = () => {
                const muted = this.settings[channel === 'bgm' ? 'bgmMuted' : 'sfxMuted'];
                button.setAttribute('aria-label', `${channel === 'bgm' ? 'BGM' : '効果音'}のミュート`); button.setAttribute('aria-pressed', String(muted));
                (button.querySelector('.cross') as HTMLElement).hidden = !muted && this.settings[channel] !== 0;
                (button.querySelector('.mute-label') as HTMLElement).textContent = muted ? 'ミュート解除' : 'ミュート';
                value.textContent = `${this.settings[channel]}%`;
            };
            const save = () => { try { localStorage.setItem('tc-audio-settings-v1', JSON.stringify(this.settings)); } catch { /* 保存不可でもその場の変更は有効。 */ } refresh(); this.changed(); };
            button.onclick = () => { const key = channel === 'bgm' ? 'bgmMuted' : 'sfxMuted'; this.settings[key] = !this.settings[key]; save(); };
            slider.oninput = () => { this.settings[channel] = Number(slider.value); save(); };
            row.append(header, slider, value); this.dialog.appendChild(row); refresh();
        }
        if (debug) this.createTuner();
        this.events.forEach(type => document.addEventListener(type, this.block));
        document.addEventListener('keydown', this.keyboard, true);
        this.resize = new ResizeObserver(this.position); this.resize.observe(canvas);
        window.addEventListener('resize', this.position); window.addEventListener('scroll', this.position, true);
        this.position();
    }
    setScreen(screen: AudioScreen) {
        if (this.screen === screen) return;
        this.screen = screen;
        this.position(); this.renderTuner?.();
    }
    private setOpen(open: boolean) {
        if (this.opened === open) return;
        this.opened = open;
        if (open) this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        this.overlay.hidden = !open; this.opener.setAttribute('aria-expanded', String(open));
        this.modalChanged(open);
        if (open) this.close.focus(); else (this.previousFocus?.isConnected ? this.previousFocus : this.opener).focus();
        // 閉じる際もDOMを残し、同じクリックが背面へ突き抜けないようにする。
    }
    private position = () => {
        const rect = this.canvas.getBoundingClientRect();
        const p = this.layout[this.screen].button, size = Math.max(44, rect.width / 941 * p.size);
        this.opener.style.left = `${Math.max(0, Math.min(window.innerWidth - size, rect.left + rect.width * p.x / 941 - size / 2))}px`;
        this.opener.style.top = `${Math.max(0, Math.min(window.innerHeight - size, rect.top + rect.height * p.y / 1672))}px`;
        this.opener.style.width = this.opener.style.height = `${size}px`;
    };
    private createTuner() {
        const tuner = document.createElement('details'); tuner.className = 'tc-audio-tuner'; this.tuner = tuner;
        const summary = document.createElement('summary'); summary.textContent = 'AUDIO UI TUNER'; tuner.appendChild(summary);
        const fields = document.createElement('div'); tuner.appendChild(fields);
        const render = () => {
            summary.textContent = `AUDIO UI TUNER · ${this.screen === 'select' ? 'SELECT' : 'DEFAULT'}`;
            fields.replaceChildren(); const p = this.layout[this.screen].button;
            for (const key of ['x', 'y', 'size'] as const) {
                const label = document.createElement('label'); label.append(key.toUpperCase());
                const range = document.createElement('input'); range.type = 'range'; range.min = key === 'size' ? '64' : '0'; range.max = key === 'x' ? '941' : key === 'y' ? '1672' : '220'; range.value = String(p[key]);
                const number = document.createElement('input'); number.type = 'number'; number.min = range.min; number.max = range.max; number.value = range.value; number.setAttribute('aria-label', `音ボタン${key.toUpperCase()}`);
                range.setAttribute('aria-label', `音ボタン${key.toUpperCase()}スライダー`);
                const set = (raw: string) => { if (!raw.trim()) return; p[key] = clamp(Number(raw), p[key], Number(range.min), Number(range.max)); range.value = number.value = String(p[key]); this.position(); try { localStorage.setItem('tc-audio-layout-v3', JSON.stringify(this.layout)); } catch { /* 調整結果はコピーでも取り出せる。 */ } };
                range.oninput = () => set(range.value); number.oninput = () => set(number.value); label.append(range, number); fields.appendChild(label);
            }
        };
        this.renderTuner = render; render();
        const copy = document.createElement('button'); copy.textContent = 'COPY AUDIO UI';
        const output = document.createElement('textarea'); output.readOnly = true; output.setAttribute('aria-label', '音ボタン配置JSON');
        copy.onclick = () => { output.value = JSON.stringify({ audioUi: this.layout }, null, 2); void navigator.clipboard?.writeText(output.value).catch(() => { output.select(); }); };
        tuner.append(copy, output); document.body.appendChild(tuner);
    }
    destroy() {
        this.setOpen(false);
        this.resize.disconnect(); window.removeEventListener('resize', this.position); window.removeEventListener('scroll', this.position, true);
        this.events.forEach(type => document.removeEventListener(type, this.block));
        document.removeEventListener('keydown', this.keyboard, true);
        this.root.remove(); this.style.remove(); this.tuner?.remove();
    }
}
