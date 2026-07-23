# Usage

The mock class `MockStarkToastNotificationService` can be imported as follows:

```typescript
import { MockStarkToastNotificationService } from "@nationalbankbelgium/stark-ui/testing";
```

Since the mock class implements the base interface of the service it mocks, you just need to provide the mock in your `TestingModule`:

```typescript
TestBed.configureTestingModule({
    imports: [...],
    declarations: [...],
    providers: [
        ...
        { provide: STARK_TOAST_NOTIFICATION_SERVICE, useValue: new MockStarkToastNotificationService() },
        ...
    ]
});
```

Then you can just inject the Stark service via the TestBed using its corresponding `InjectionToken`:

```typescript
// this will inject the instantiated mock class
mockStarkToastNotificationService = TestBed.inject(STARK_TOAST_NOTIFICATION_SERVICE);
```

In fact, every method of the base interface is simply mocked
with a [Vitest mock function](https://vitest.dev/api/mock.html) which can then be used in the unit tests to:

- return custom values
- override a method with a custom function
- asserting that they are actually called
- use the other inspection and implementation controls exposed by Vitest mocks.

For example:

```typescript
// returning custom value
mockStarkToastNotificationService.show.mockReturnValue(someCustomObservable);

// overriding a method with a custom function
mockStarkToastNotificationService.show.mockImplementation((message: StarkToastMessage) => {
  // some custom logic
});

// asserting that a method was indeed called
expect(mockStarkToastNotificationService.hide).toHaveBeenCalledTimes(1);
```
