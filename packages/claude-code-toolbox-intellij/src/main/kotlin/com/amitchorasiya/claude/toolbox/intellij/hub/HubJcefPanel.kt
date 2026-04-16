package com.amitchorasiya.claude.toolbox.intellij.hub

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.components.JBLabel
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import java.nio.charset.StandardCharsets
import java.util.Base64
import javax.swing.JPanel

/**
 * Embeds the same hub HTML as VS Code (exported to [hub-body.html]) inside JCEF and bridges postMessage to Kotlin.
 */
class HubJcefPanel(project: Project) : JPanel(BorderLayout()), Disposable {

    private val browser: JBCefBrowser?

    init {
        if (!JBCefApp.isSupported()) {
            browser = null
            add(
                JBLabel(
                    "<html>JCEF is not available in this runtime. Use a full IntelliJ IDEA install, or open the project in VS Code for the hub.</html>",
                ),
                BorderLayout.NORTH,
            )
        } else {
            val br = JBCefBrowser()
            browser = br
            Disposer.register(this, br)

            val hubBridge = project.getService(ClaudeHubBridge::class.java)
            hubBridge.postEnvelope = { env ->
                ApplicationManager.getApplication().invokeLater {
                    postEnvelopeToPage(br, env)
                }
            }
            Disposer.register(this) {
                hubBridge.postEnvelope = null
            }

            val query = JBCefJSQuery.create(br as JBCefBrowserBase)
            query.addHandler { request ->
                ApplicationManager.getApplication().invokeLater {
                    HubMessageHandler.handle(project, request) { env ->
                        ApplicationManager.getApplication().invokeLater {
                            postEnvelopeToPage(br, env)
                        }
                    }
                }
                JBCefJSQuery.Response("ok")
            }

            val html = loadHubHtml()
            br.loadHTML(html, "http://cloude.toolbox/hub")

            br.jbCefClient.addLoadHandler(
                object : CefLoadHandlerAdapter() {
                    override fun onLoadEnd(cefBrowser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                        if (frame?.isMain != true) return
                        injectBridge(br, query)
                        flushPending(br)
                        HubStateService.postFullState(project) { env ->
                            ApplicationManager.getApplication().invokeLater {
                                postEnvelopeToPage(br, env)
                            }
                        }
                    }
                },
                br.cefBrowser,
            )

            add(br.component, BorderLayout.CENTER)
        }
    }

    override fun dispose() {
        browser?.dispose()
    }

    private fun loadHubHtml(): String {
        val stream = javaClass.classLoader.getResourceAsStream("hub/hub-body.html")
            ?: error("hub/hub-body.html missing — run: cd packages/cloude-code-toolbox && npm run compile && node scripts/export-hub-for-intellij.mjs")
        return stream.use { it.readBytes().toString(StandardCharsets.UTF_8) }
    }

    private fun injectBridge(br: JBCefBrowser, query: JBCefJSQuery) {
        val injected = query.inject("request")
        val js =
            """
            window.cloudeBridgePost = function(request) {
              $injected
            };
            """.trimIndent()
        br.cefBrowser.executeJavaScript(js, br.cefBrowser.url, 0)
    }

    private fun flushPending(br: JBCefBrowser) {
        val js =
            """
            (function(){
              if (!window.__cloudePending || !window.cloudeBridgePost) return;
              var p = window.__cloudePending.splice(0);
              for (var i = 0; i < p.length; i++) window.cloudeBridgePost(p[i]);
            })();
            """.trimIndent()
        br.cefBrowser.executeJavaScript(js, br.cefBrowser.url, 0)
    }

    private fun postEnvelopeToPage(br: JBCefBrowser, envelope: JsonObject) {
        val json = Gson().toJson(envelope)
        val b64 = Base64.getEncoder().encodeToString(json.toByteArray(StandardCharsets.UTF_8))
        val js =
            """
            (function(){
              try {
                var json = decodeURIComponent(escape(atob('$b64')));
                var data = JSON.parse(json);
                window.dispatchEvent(new MessageEvent('message', { data: data, origin: 'http://cloude.toolbox' }));
              } catch (e) { console.error('cloude host', e); }
            })();
            """.trimIndent()
        br.cefBrowser.executeJavaScript(js, br.cefBrowser.url, 0)
    }
}
