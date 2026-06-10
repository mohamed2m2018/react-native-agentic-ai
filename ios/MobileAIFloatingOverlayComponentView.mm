#ifdef RCT_NEW_ARCH_ENABLED

#import "MobileAIFloatingOverlayComponentView.h"
#import <React/RCTFabricComponentsPlugins.h>
#import <react/renderer/components/RNMobileAIOverlaySpec/ComponentDescriptors.h>
#import <react/renderer/components/RNMobileAIOverlaySpec/Props.h>
#import <react/renderer/components/RNMobileAIOverlaySpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@implementation MobileAIFloatingOverlayComponentView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<MobileAIFloatingOverlayComponentDescriptor>();
}

+ (void)load
{
  [super load];
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const MobileAIFloatingOverlayProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(Props::Shared const&)props oldProps:(Props::Shared const&)oldProps
{
  [super updateProps:props oldProps:oldProps];
}

@end

Class<RCTComponentViewProtocol> MobileAIFloatingOverlayCls(void)
{
  return MobileAIFloatingOverlayComponentView.class;
}

#endif
