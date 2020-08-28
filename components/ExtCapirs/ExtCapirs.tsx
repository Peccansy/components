import * as React from 'react';
import { render } from 'react-dom';
import { camelCase } from 'camel-case';


import { IWidgetParams, MessageType } from './commonInterfaces';
import { inlineScript, GLOBAL_CALLBACKS_PROPERTY } from './inlineScript';
import { ExtEmbed } from '../ExtEmbed/ExtEmbed';

import './ExtCapirs.scss';

interface IState {
    htmlString: string | null;
    loadingState: LoadingState;
    height: number;
    width: number | null;
}

interface IExtCapirsProps {
    'data-begun-auto-pad': number;
    'data-begun-block-id': number;
    'data-width': string;
    'data-height': string;
    'data-json'?: Record<string, string | number>;
}

export interface IMessageData {
    type: string;
    height?: number;
    width?: number;
}

const DEFAULT_HEIGHT = 320;
const MAX_Z_INDEX = 214748363;

enum LoadingState {
    inProgress = 'inProgress',
    succeed = 'succeed',
    failed = 'failed'
}

interface IMessageHandlerArguments {
    messageData: IMessageData;
    origin: MessageEvent['origin'];
    source: Window;
}

export class ExtCapirs extends React.PureComponent<IExtCapirsProps, IState> {
    public readonly state: IState = {
        htmlString: null,
        loadingState: LoadingState.inProgress,
        height: DEFAULT_HEIGHT,
        width: null
    };

    private messagesHandlersMap = {
        [MessageType.loadingSucceed]: ({ messageData }: IMessageHandlerArguments) =>
            /* eslint-disable-next-line */
            this.handleLoadingSucceed(messageData),
        [MessageType.loadingFailed]: () => this.handleLoadingFailed(),
        [MessageType.getLocation]: ({ origin, source }: IMessageHandlerArguments) => this.sendLocation(source, origin)
    };

    private constructor(props: IExtCapirsProps) {
        super(props);
        this.handlePostMessage = this.handlePostMessage.bind(this);
    }

    public componentDidMount(): void {
        if (typeof window === 'undefined') {
            return;
        }

        // Преобразуем все пришедшие data-пропсы в параметры виджета
        const widgetParams: IWidgetParams = Object.keys(this.props)
            .reduce((agr, propName) => {
                if (propName.indexOf('data-') === 0) {
                    const camelCasedName = camelCase(propName.slice(5));
                    agr[camelCasedName] = this.props[propName];
                }

                return agr;
            }, {} as unknown as IWidgetParams);

        this.useInitialDimensions(widgetParams.width, widgetParams.height);
        this.composeHtmlString(widgetParams);
    }

    public render(): React.ReactNode {
        return this.state.loadingState === LoadingState.failed ? null : (
            <ExtEmbed
                html={this.state.htmlString || ''}
                iframeClass={this.state.width ? '' : 'ext-embed__ext-capirs_fill'}
                iframeHeight={this.state.height.toString()}
                iframeWidth={this.state.width === null ? '' : this.state.width.toString()}
                isLoaded={this.state.loadingState === LoadingState.succeed}
                onMessage={this.handlePostMessage}
            />
        );
    }

    /**
     * Use initial dimensions which are passed by the platform.
     * These values are applied to the iframe directly.
     * @param width initial width of iframe
     * @param height initial height of iframe
     */
    private useInitialDimensions(
        width: IWidgetParams['width'],
        height: IWidgetParams['height']
    ): void {
        this.setState({
            height: typeof height === 'number' ? height : DEFAULT_HEIGHT,
            width: typeof width === 'number' ? width : null
        });
    }

    private composeHtmlString(widgetParams: IWidgetParams): void {
        if (typeof window !== 'undefined') {
            const html = (
                <>
                    <div className="capirs-container" style={{ zIndex: MAX_Z_INDEX }} />
                    <link as="script" href="//ssp.rambler.ru/capirs_async.js" rel="preload" />
                    <script
                        /* eslint-disable-next-line */
                        dangerouslySetInnerHTML={{ __html:
                        `(${inlineScript.toString()})` +
                        `(window,document,'${GLOBAL_CALLBACKS_PROPERTY}',${JSON.stringify(widgetParams)})` }}
                    />
                    <script src="//ssp.rambler.ru/capirs_async.js" />
                </>
            );

            const tempDiv = document.createElement('div');
            render(html, tempDiv, () => {
                this.setState({ htmlString: tempDiv.innerHTML });
            });
        }
    }

    private handlePostMessage(event: MessageEvent): void {
        const needToProcessMessage =
            event.data &&
            event.data.message &&
            Object.prototype.hasOwnProperty.call(
                this.messagesHandlersMap,
                event.data.message
            );

        if (needToProcessMessage) {
            this.messagesHandlersMap[event.data.message]({
                origin: event.origin,
                source: event.source,
                messageData: event.data
            });
        }
    }

    private handleLoadingSucceed(messageData: IMessageData): void {
        this.setState({
            loadingState: LoadingState.succeed,
            height: messageData.height || DEFAULT_HEIGHT,
            width: messageData.width || null
        });
    }

    private handleLoadingFailed(): void {
        this.setState({ loadingState: LoadingState.failed });
    }

    private sendLocation(source: Window, origin: MessageEvent['origin']): void {
        if (typeof window !== 'undefined') {
            source.postMessage({
                message: MessageType.saveLocation,
                href: location.href,
                referrer: document.referrer
            }, origin);
        }
    }
}
