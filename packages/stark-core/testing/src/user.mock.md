# Usage

The mock class `MockStarkUserService` can be imported as follows:

```typescript
import { MockStarkUserService } from "@nationalbankbelgium/stark-core/testing";
```

Since the mock class implements the base interface of the service it mocks, you just need to provide the mock in your `TestingModule`:

```typescript
TestBed.configureTestingModule({
    imports: [...],
    declarations: [...],
    providers: [
        ...
        { provide: STARK_USER_SERVICE, useValue: new MockStarkUserService() },
        ...
    ]
});
```

Then you can just inject the Stark service via the TestBed using its corresponding `InjectionToken`:

```typescript
// this will inject the instantiated mock class
mockUserService = TestBed.inject(STARK_USER_SERVICE);
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
mockUserService.fetchUserProfile.mockReturnValue(of(someUser));

// overriding a method with a custom function
mockUserService.fetchUserProfile.mockImplementation(() => {
  // some custom logic to return a specific value
});

// asserting that a method was indeed called
expect(mockUserService.fetchUserProfile).toHaveBeenCalledTimes(1);
```
