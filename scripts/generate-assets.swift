// Run: swift -module-cache-path /tmp/bp-swift-cache scripts/generate-assets.swift
// Uses macOS AppKit to render the existing heart design as opaque PNG assets.
import AppKit
import CoreText

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> CGColor {
    CGColor(colorSpace:sRGB, components:[r/255, g/255, b/255, 1])!
}
let green = color(57, 134, 90)
func heart(_ c: CGContext, x: CGFloat, y: CGFloat, size: CGFloat) {
    c.saveGState()
    c.translateBy(x: x, y: y + size)
    c.scaleBy(x: size/512, y: -size/512)
    c.setFillColor(green)
    c.fill(CGRect(x: 0, y: 0, width: 512, height: 512))
    c.beginPath(); c.move(to: CGPoint(x: 256,y: 390))
    c.addCurve(to: CGPoint(x: 105,y: 190), control1: CGPoint(x: 210,y: 350), control2: CGPoint(x: 105,y: 275))
    c.addCurve(to: CGPoint(x: 256,y: 175), control1: CGPoint(x: 105,y: 105), control2: CGPoint(x: 220,y: 90))
    c.addCurve(to: CGPoint(x: 407,y: 190), control1: CGPoint(x: 292,y: 90), control2: CGPoint(x: 407,y: 105))
    c.addCurve(to: CGPoint(x: 256,y: 390), control1: CGPoint(x: 407,y: 275), control2: CGPoint(x: 302,y: 350))
    c.closePath(); c.setFillColor(CGColor(gray: 1, alpha: 1)); c.fillPath()
    c.beginPath(); c.move(to: CGPoint(x:130,y:255))
    for (x,y) in [(205,255),(235,205),(275,305),(310,255),(382,255)] {
        c.addLine(to: CGPoint(x:x,y:y))
    }
    c.setStrokeColor(green); c.setLineWidth(19); c.setLineCap(.round); c.setLineJoin(.round); c.strokePath()
    c.restoreGState()
}
func writePNG(_ path: String, width: Int, height: Int, draw: (CGContext)->Void) throws {
    let context = CGContext(data:nil, width:width, height:height, bitsPerComponent:8,
                            bytesPerRow:width*4, space:sRGB,
                            bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue)!
    draw(context)
    let rep = NSBitmapImageRep(cgImage: context.makeImage()!)
    let url = root.appendingPathComponent(path)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories:true)
    try rep.representation(using:.png, properties:[:])!.write(to:url)
}
for size in [152,167,180,192,512] {
    let name = size < 192 ? "apple-touch-icon-\(size)" : "icon-\(size)"
    try writePNG("icons/\(name).png", width:size, height:size) { c in
        heart(c, x:0, y:0, size:CGFloat(size))
    }
}
// CSS screen dimensions and device pixel ratios: iPhone SE through current
// large iPhones, plus common iPad / iPad Pro sizes. Both orientations are supplied.
let devices = [(320,568,2),(375,667,2),(414,736,3),(375,812,3),(414,896,2),
               (414,896,3),(390,844,3),(393,852,3),(402,874,3),(420,912,3),
               (428,926,3),(430,932,3),(440,956,3),(768,1024,2),(810,1080,2),
               (820,1180,2),(834,1112,2),(834,1194,2),(1024,1366,2),
               (744,1133,2),(820,1194,2),(834,1210,2),(1032,1376,2)]
var links = [String]()
var generated = Set<String>()
for (w,h,ratio) in devices {
    for orientation in ["portrait","landscape"] {
        let width = (orientation == "portrait" ? w : h) * ratio
        let height = (orientation == "portrait" ? h : w) * ratio
        for dark in [false,true] {
            let theme = dark ? "dark" : "light"
            let file = "icons/startup/\(width)x\(height)-\(theme).png"
            if generated.insert(file).inserted {
                try writePNG(file, width:width, height:height) { c in
                    c.setFillColor(dark ? color(16,28,22) : color(234,244,236))
                    c.fill(CGRect(x:0,y:0,width:width,height:height))
                    let scale = CGFloat(ratio)
                    let size: CGFloat = 100 * scale
                    let x = (CGFloat(width)-size)/2
                    let y = CGFloat(height)/2
                    c.saveGState()
                    c.addPath(CGPath(roundedRect: CGRect(x:x,y:y,width:size,height:size),
                                     cornerWidth:24*scale, cornerHeight:24*scale, transform:nil))
                    c.clip(); heart(c,x:x,y:y,size:size); c.restoreGState()
                    let font = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 24*scale,nil)
                    let text = NSAttributedString(string:"BP Tracker", attributes:[
                        NSAttributedString.Key(kCTFontAttributeName as String):font,
                        NSAttributedString.Key(kCTForegroundColorAttributeName as String):
                            dark ? color(189,231,203) : color(36,92,60)
                    ])
                    let line = CTLineCreateWithAttributedString(text as CFAttributedString)
                    let bounds = CTLineGetBoundsWithOptions(line, [])
                    c.textPosition = CGPoint(x:(CGFloat(width)-bounds.width)/2,y:y-45*scale)
                    CTLineDraw(line,c)
                }
            }
            let media = "(device-width: \(w)px) and (device-height: \(h)px) and (-webkit-device-pixel-ratio: \(ratio)) and (orientation: \(orientation)) and (prefers-color-scheme: \(theme))"
            links.append("  <link rel=\"apple-touch-startup-image\" href=\"\(file)\" media=\"\(media)\">")
        }
    }
}
let htmlURL = root.appendingPathComponent("index.html")
let html = try String(contentsOf:htmlURL, encoding:.utf8)
let start = "  <!-- IOS_STARTUP_IMAGES -->"
let end = "  <!-- /IOS_STARTUP_IMAGES -->"
let block = start + "\n" + links.joined(separator:"\n") + "\n" + end
let updated: String
if let a = html.range(of:start), let b = html.range(of:end) {
    updated = String(html[..<a.lowerBound]) + block + String(html[b.upperBound...])
} else { updated = html.replacingOccurrences(of:start,with:block) }
try updated.write(to:htmlURL,atomically:true,encoding:.utf8)
print("Generated 5 icons and \(generated.count) startup images; updated HTML links.")
