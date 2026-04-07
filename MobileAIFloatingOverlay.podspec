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

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "NO",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "OTHER_CPLUSPLUSFLAGS" => "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1"
  }

  install_modules_dependencies(s)
end
