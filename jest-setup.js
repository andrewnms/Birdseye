jest.mock("react-native-safe-area-context", () => {
  const mock = jest.requireActual("react-native-safe-area-context/jest/mock");
  return mock.default ?? mock;
});
