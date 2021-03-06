import { uploadSourceMap } from '@ohbug/cli'
import { LOG_PREFIX } from './constants'
import type { Compiler, compilation } from 'webpack'

export interface Config {
  apiKey: string
  appVersion: string
  appType?: string
  url?: string
}
export interface Options extends Config {
  publicPath?: string
}
export interface Asset extends Config {
  path: string
}

class OhbugWebpackPlugin implements Options {
  apiKey: string
  appVersion: string
  appType?: string
  publicPath?: string
  url?: string

  constructor(options: Options) {
    this.validate(options)

    this.apiKey = options.apiKey
    this.appVersion = options.appVersion
    this.appType = options.appType
    this.publicPath = options.publicPath
    this.url = options.url
  }

  validate(options: Options): void {
    if (typeof options.apiKey !== 'string' || options.apiKey.length < 1) {
      throw new Error(`${LOG_PREFIX} "apiKey" is required!`)
    }
    if (typeof options.appVersion !== 'string' || options.appVersion.length < 1) {
      throw new Error(`${LOG_PREFIX} "appVersion" is required!`)
    }
  }

  getConfig(): Config {
    const config: Config = {
      apiKey: this.apiKey,
      appVersion: this.appVersion,
    }
    if (this.appType) config.appType = this.appType
    if (this.url) config.url = this.url

    return config
  }

  getAssets(compiler: Compiler, compilation: compilation.Compilation): Asset[] | undefined {
    const { chunks } = compilation.getStats().toJson()
    const outputPath = compilation.getPath(compiler.outputPath, {})

    return chunks?.reduce((result, chunk) => {
      const filename = chunk.files.find((file) => /\.js\.map$/.test(file))
      if (!filename) {
        return result
      }
      const path = compiler.outputFileSystem.join(outputPath, filename)

      return [...result, { path, ...this.getConfig() }]
    }, [])
  }

  apply(compiler: Compiler) {
    const plugin = async (compilation: compilation.Compilation) => {
      const assets = this.getAssets(compiler, compilation)
      if (assets?.length) {
        return await Promise.all(assets.map((asset) => uploadSourceMap(asset)))
      }
    }

    if (compiler.hooks && compiler.hooks.afterEmit) {
      compiler.hooks.afterEmit.tapPromise('OhbugWebpackPlugin', plugin)
    } else {
      compiler.plugin('after-emit', plugin)
    }
  }
}

export default OhbugWebpackPlugin
