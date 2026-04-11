import UIKit
import Capacitor
import InAppViewDebugger

#if DEBUG
import FLEX
#endif

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        #if DEBUG
        // FLEX explorer: 3-finger long-press anywhere in-app to toggle.
        // Registered only in Debug, never ships to TestFlight/App Store.
        FLEXManager.shared.registerGlobalEntry(withName: "miraculturee", objectFutureBlock: { () -> Any? in
            return UIApplication.shared
        })
        #endif
        return true
    }

    @objc private func presentViewDebugger() {
        InAppViewDebugger.present()
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    // 4-finger triple-tap → present InAppViewDebugger. 4 touches × 3 taps
    // is never accidental, won't conflict with iOS system gestures, yet
    // easy to remember for devs/stakeholders. Attached here (not in
    // didFinishLaunching) because Capacitor's window is built from
    // Main.storyboard and only exists once the app is active.
    func applicationDidBecomeActive(_ application: UIApplication) {
        guard let win = application.windows.first else { return }
        if win.gestureRecognizers?.contains(where: { $0.name == "iavd-trigger" }) == true { return }
        let tap = UITapGestureRecognizer(target: self, action: #selector(presentViewDebugger))
        tap.numberOfTapsRequired = 3
        tap.numberOfTouchesRequired = 4
        tap.cancelsTouchesInView = false
        tap.name = "iavd-trigger"
        win.addGestureRecognizer(tap)
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
