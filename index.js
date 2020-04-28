import React, { useEffect, useState } from 'react';
import { matchPath } from 'react-router';

const PAGE_LOADERS = [];

function resolveModule(obj) {
    return obj && obj.__esModule ? obj.default : obj;
}

function Loadable(loadableConfig) {
    let res = null;
    if(!loadableConfig.loader || !loadableConfig.path) {
        throw Error('params: loader and path required!');
    }

    function tryGetInitProps(component, match, resolve, reject, passthrough = {}) {
        if(!component) {
            return reject('component not exist!');
        }
        if(typeof component.getInitialProps === 'function' && typeof initProps === 'undefined') {
            console.log("invok component.getInitialProps....")
            component.getInitialProps({ match }).then(initProps => {
                res = Object.assign({
                    component,
                    initProps,
                    ready: true,
                }, passthrough);
                resolve(res);
            }, () => {
                reject('invok getInitialProps fail!')
            })
        }
        else {
            res = Object.assign({
                component,
                ready: true,
            }, passthrough);
            resolve(res);
        }
    }

    const init = (match, initProps) => {
        return new Promise((resolve, reject) => {
            const { loader } = loadableConfig;
            let component = null;

            if(typeof loader.isReady === 'function'
               && typeof loader.chunkName === 'function'
               && typeof loader.requireAsync === 'function'
               && typeof loader.requireSync === 'function'
            ) {
                let chunkName = loader.chunkName();
                const passthrough = {chunkName};

                if(!loader.isReady()) {
                    loader.requireAsync().then(r => {
                        component = resolveModule(r);
                        tryGetInitProps(component, match, resolve, reject, passthrough);
                    }, () => {
                        reject('requireAsync component fail!')
                    })
                }
                else {
                    component = resolveModule(loader.requireSync());
                    tryGetInitProps(component, match, resolve, reject, passthrough);
                }
            }
            else if(typeof loader === 'function') {
                loader().then(r => {
                    component = resolveModule(r);
                    tryGetInitProps(component, match, resolve, reject);
                }, () => {
                    reject('requireAsync component fail!')
                })
            }
            else {
                reject('loader must be a func, or  obj enhanced by babel plugin!')
            }
        })
    }
    PAGE_LOADERS.push({
        loadableConfig,
        init,
    });

    return class LoadableComponent extends React.Component {
        constructor(props) {
            super(props);
        }
        componentDidMount() {
            init().then(() => {
                console.log('....async LoadableComponent update....')
                this.forceUpdate();
            }, (err) => {
                console.error('init component err', err);
                this.err = err;
            })
        }
        render() {
            console.log('==========loadable render==========', res)
            if(res && res.ready) {
                const { component: Component, initProps } = res;

                return loadableConfig.render ? loadableConfig.render({
                    Component,
                    initProps,
                    props: this.props,
                }) : React.createElement(Component, { initProps, ...this.props })
            }
            if(this.err && loadableConfig.error) {
                return React.createElement(loadableConfig.error, {err: this.err});
            }
            return loadableConfig.loadding ? React.createElement(loadableConfig.loadding) : null;
        }
    }
}

Loadable.loadReady = function (url, initProps, matchPathFunc = matchPath) {
    let plSize = PAGE_LOADERS.length;
    let loaderConfig = null;
    let init = null;
    let match = null;

    for(let i = 0; i < plSize; i++) {
        const pageLoader = PAGE_LOADERS[i];
        const loadableConfig = pageLoader.loadableConfig;
        init = pageLoader.init;

        match = matchPathFunc(url, {
            path: loadableConfig.path
        })

        if(match) {
            console.log('loadReady: match success:', loadableConfig.path);
            break;
        }
    }

    if(typeof init === 'function' && match) {
        return init(match, initProps).then(res => {
            console.log('loadReady: match result: \n path:', url, ', router:', res);
            res.path = url;
            return res;
        })
    }
    return Promise.reject('no macth');
}

export default Loadable;

