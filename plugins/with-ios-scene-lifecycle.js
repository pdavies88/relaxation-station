// Adopts the UIKit scene-based life cycle, which the iOS 27 SDK requires at launch
// ("UIScene life cycle is required for apps built with this SDK").
//
// Expo SDK 57 ships the runtime support (`ExpoAppSceneDelegate`, `ExpoReactNativeFactoryProvider`)
// but its prebuild template still creates the window in the AppDelegate. This mirrors the
// SDK 58 template. Remove this plugin after upgrading to SDK 58.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// Expo's base class, exposed to Objective-C under this name so Info.plist can reference it directly.
const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

const WINDOW_START_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\s*/;

function adoptSceneLifecycle(contents) {
  if (contents.includes('ExpoReactNativeFactoryProvider')) return contents;

  if (!WINDOW_START_BLOCK.test(contents)) {
    throw new Error(
      '[with-ios-scene-lifecycle] AppDelegate.swift did not match the expected Expo SDK 57 template.',
    );
  }

  return contents
    .replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
    .replace(
      WINDOW_START_BLOCK,
      '    // The scene delegate creates the window and starts React Native (scene life cycle).\n    ',
    );
}

module.exports = function withIosSceneLifecycle(config) {
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('[with-ios-scene-lifecycle] Only Swift AppDelegates are supported.');
    }
    mod.modResults.contents = adoptSceneLifecycle(mod.modResults.contents);
    return mod;
  });

  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return mod;
  });

  return config;
};
