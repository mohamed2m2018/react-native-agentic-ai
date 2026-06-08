require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "MobileAIFloatingOverlay"
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = package['homepage'] || "https://github.com/mobileai"
  s.license      = package['license']
  s.authors      = package['author']

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/mobileai/react-native-ai-agent.git", :tag => "#{s.version}" }

  s.source_files = "ios/MobileAIFloatingOverlayComponentView.{h,m,mm,cpp}"

  # Disable folly coroutines — RCT-Folly doesn't ship coroutine headers.
  # Uses compiler_flags (not pod_target_xcconfig) because
  # install_modules_dependencies overwrites OTHER_CPLUSPLUSFLAGS.
  s.compiler_flags = '-DFOLLY_HAS_COROUTINES=0'

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "NO"
  }

  install_modules_dependencies(s)
end
