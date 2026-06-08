module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.mobileai.overlay.MobileAIOverlayPackage;',
        packageInstance: 'new MobileAIOverlayPackage()',
      },
      ios: {},
    },
  },
};
