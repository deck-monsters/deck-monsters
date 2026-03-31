import { EventEmitter } from 'node:events';
import { globalSemaphore } from '../helpers/semaphore.js';

export interface BaseClassOptions {
	[key: string]: unknown;
}

export interface BaseClassStatic {
	eventPrefix: string;
	defaults?: BaseClassOptions;
}

type InstanceStore = { id?: symbol };

export class BaseClass<TOptions extends BaseClassOptions = BaseClassOptions> {
	protected semaphore!: EventEmitter;
	protected optionsStore: Partial<TOptions> = {};
	protected instance?: InstanceStore;
	original?: BaseClass<TOptions>;

	constructor(options?: Partial<TOptions>, semaphore = new EventEmitter()) {
		if (this.name === BaseClass.name) {
			throw new Error('The BaseClass should not be instantiated directly!');
		}

		if (!this.eventPrefix) {
			throw new Error('An eventPrefix is required.');
		}

		this.semaphore = semaphore;
		this.setOptions(options);
		this.emit('created');
	}

	get eventPrefix(): string {
		return (this.constructor as unknown as BaseClassStatic).eventPrefix;
	}

	get name(): string {
		return this.constructor.name;
	}

	get instanceId(): symbol {
		if (this.original) {
			return this.original.instanceId;
		}

		if (!this.instance) {
			this.instance = {};
		}

		if (!this.instance.id) {
			this.instance.id = Symbol('instanceId');
		}

		return this.instance.id;
	}

	get defaults(): BaseClassOptions | undefined {
		return (this.constructor as unknown as BaseClassStatic).defaults;
	}

	get options(): TOptions {
		return {
			...this.defaults,
			...this.optionsStore,
		} as TOptions;
	}

	setOptions(options?: Partial<TOptions>): void {
		const optionsStore = {
			...this.optionsStore,
			...options,
		} as Partial<TOptions>;

		(Object.keys(optionsStore) as Array<keyof TOptions>).forEach((key) => {
			if (optionsStore[key] === undefined) {
				delete optionsStore[key];
			}
		});

		this.optionsStore = optionsStore;

		this.emit('updated');
		globalSemaphore.emit('stateChange');
	}

	emit(event: string, ...args: unknown[]): void {
		this.semaphore.emit(event, this.name, this, ...args);
		globalSemaphore.emit(`${this.eventPrefix}.${event}`, this.name, this, ...args);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string, func: (...args: any[]) => void): (...args: any[]) => void {
		const boundFunc = func.bind(this);
		this.semaphore.on(event, boundFunc);
		return boundFunc;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	off(event: string, func: (...args: any[]) => void): void {
		this.semaphore.off(event, func);
	}

	clone(): this {
		const clone = Object.assign(Object.create(this), this) as this;
		clone.setOptions(this.options);
		clone.original = (this.original ?? this) as BaseClass<TOptions>;
		return clone;
	}

	toJSON(): { name: string; options: Partial<TOptions> } {
		const { defaults, options } = this;
		const strippedOptions = { ...options } as Partial<TOptions>;

		if (defaults) {
			(Object.keys(defaults) as Array<keyof TOptions>).forEach((key) => {
				if (strippedOptions[key] === defaults[key as string]) {
					delete strippedOptions[key];
				}
			});
		}

		return {
			name: this.name,
			options: strippedOptions,
		};
	}

	toString(): string {
		return JSON.stringify(this);
	}
}
