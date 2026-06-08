#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

#import <react/renderer/components/RNMobileAIOverlaySpec/ComponentDescriptors.h>
#import <react/renderer/components/RNMobileAIOverlaySpec/EventEmitters.h>
#import <react/renderer/components/RNMobileAIOverlaySpec/Props.h>
#import <react/renderer/components/RNMobileAIOverlaySpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

NS_ASSUME_NONNULL_BEGIN
@interface MobileAIFloatingOverlayComponentView : RCTViewComponentView
@end
NS_ASSUME_NONNULL_END

using namespace facebook::react;

@interface MobileAIFloatingOverlayComponentView () <RCTMobileAIFloatingOverlayViewProtocol>
@end

@implementation MobileAIFloatingOverlayComponentView {
    UIView * _view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<MobileAIFloatingOverlayComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const MobileAIFloatingOverlayProps>();
    _props = defaultProps;

    _view = [[UIView alloc] init];

    self.contentView = _view;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<MobileAIFloatingOverlayProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<MobileAIFloatingOverlayProps const>(props);

    [super updateProps:props oldProps:oldProps];
}

@end

Class<RCTComponentViewProtocol> MobileAIFloatingOverlayCls(void)
{
  return MobileAIFloatingOverlayComponentView.class;
}

// ─── Linker Fix: Force inclusion of the library ────────────────

#import <React/RCTViewManager.h>

@interface MobileAIFloatingOverlayManager : RCTViewManager
@end

@implementation MobileAIFloatingOverlayManager
RCT_EXPORT_MODULE(MobileAIFloatingOverlay)

- (UIView *)view
{
  return [[UIView alloc] init];
}
@end
